import { Request, Response, NextFunction } from 'express'; // Import NextFunction
import Stripe from 'stripe';
import { supabase } from '../lib/supabaseClient'; // Assuming supabase client is configured
import logger from '../utils/logger'; // Import the logger
import { catchAsync, BadRequestError, InternalServerError } from '../utils/appErrors'; // Import custom errors and catchAsync

// Initialize Stripe with the secret key and API version.
// The API version is temporarily set to '2026-01-28.clover' as a workaround
// for a TypeScript type conflict encountered during compilation.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2026-01-28.clover' as any, // Use the version requested by TS for now
});

/**
 * @description Creates a Stripe Checkout Session for a new subscription.
 * This endpoint is called from the frontend when a user initiates the premium upgrade.
 * It redirects the user to Stripe's hosted checkout page.
 * @param req - The Express request object, containing userId and email in the body.
 * @param res - The Express response object.
 */
export const createCheckoutSession = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { userId, email } = req.body; // Extract user ID and email from the request body

  // Validate required input
  if (!userId || !email) {
    throw new BadRequestError('User ID and email are required to create a checkout session.');
  }

  // Retrieve Stripe Price ID from environment variables
  const priceId = process.env.STRIPE_PRICE_ID;

  if (!priceId) {
    logger.error('STRIPE_PRICE_ID is not set in environment variables.');
    throw new InternalServerError('Server configuration error: Stripe Price ID missing.');
  }

  // Create a new Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'], // Allow card payments
    line_items: [
      {
        price: priceId, // The ID of the Stripe Price object for the subscription
        quantity: 1,
      },
    ],
    mode: 'subscription', // Set mode to 'subscription' for recurring payments
    // URLs to redirect to after successful payment or cancellation
    success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.CLIENT_URL}/cancel`,
    client_reference_id: userId, // Link this session to our internal user ID for easy lookup
    customer_email: email, // Pre-fill customer email in Stripe Checkout
    metadata: {
      userId: userId, // Store our internal userId in Stripe's metadata for webhook processing
    },
  });

  // Respond with the session ID and URL to redirect the frontend
  res.status(200).json({ sessionId: session.id, url: session.url });
});

/**
 * @description Handles Stripe webhook events to keep our database synchronized with Stripe.
 * This function verifies the webhook signature for security and processes various event types.
 * @param req - The Express request object, containing the raw Stripe event in the body.
 * @param res - The Express response object.
 */
export const handleWebhook = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature']; // Get the Stripe-Signature header
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET; // Retrieve webhook secret from environment variables

  // Validate webhook secret configuration
  if (!webhookSecret) {
    logger.error('STRIPE_WEBHOOK_SECRET is not set in environment variables.');
    return res.status(500).send('Webhook secret not configured.');
  }

  let event: Stripe.Event;

  // Verify the webhook signature to ensure the event is from Stripe and has not been tampered with
  try {
    event = stripe.webhooks.constructEvent(req.body, sig as string, webhookSecret);
  } catch (err: any) {
    logger.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  logger.info('Stripe Webhook Event Received:', event.type);

  // Process different types of Stripe events
  switch (event.type) {
    case 'checkout.session.completed':
      // Occurs when a customer successfully completes the checkout process.
      // This is our primary trigger to provision premium access.
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;
      const userId = session.metadata?.userId; // Retrieve our internal userId from session metadata

      // Critical data validation
      if (!userId || !subscriptionId || !customerId) {
        logger.error('Missing critical data in checkout.session.completed event:', { userId, subscriptionId, customerId });
        return res.status(400).send('Missing critical data in event.');
      }

      try {
        // Retrieve the full subscription object from Stripe to get all details,
        // including product and price IDs which might not be fully available on the session object.
        const fullSubscription = await stripe.subscriptions.retrieve(subscriptionId) as Stripe.Subscription;
        const priceId = fullSubscription.items.data[0].price?.id;
        const productId = fullSubscription.items.data[0].price?.product as string;

        if (!priceId || !productId) {
          logger.error('Could not retrieve price or product ID from full subscription object.');
          return res.status(500).send('Failed to get subscription details.');
        }

        // Upsert (insert or update) the subscription record in our Supabase database.
        // This ensures the user_subscriptions table reflects the latest state.
        const { error } = await supabase.from('user_subscriptions').upsert({
          id: fullSubscription.id,
          user_id: userId,
          status: fullSubscription.status,
          // Convert Unix timestamps to ISO strings for database storage
          current_period_start: new Date((fullSubscription as any).current_period_start * 1000).toISOString(),
          current_period_end: new Date((fullSubscription as any).current_period_end * 1000).toISOString(),
          product_id: productId,
          price_id: priceId,
          customer_id: customerId,
          created_at: new Date(fullSubscription.created * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' }); // Conflict on 'id' means update if exists

        if (error) {
          logger.error('Supabase upsert error for checkout.session.completed:', error);
          return res.status(500).send('Supabase upsert failed.');
        }

        // The 'update_profile_premium_status' RLS trigger in Supabase automatically
        // updates the 'profiles.is_premium' field based on the subscription status.

      } catch (e) {
        logger.error('Error processing checkout.session.completed:', e);
        return res.status(500).send('Webhook handler failed.');
      }
      break;

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      // Occurs when a subscription changes status (e.g., renewed, canceled, paused).
      // We update or remove the subscription record in our database accordingly.
      const subObject = event.data.object as Stripe.Subscription; // The updated/deleted subscription object
      const subscriptionUserId = subObject.metadata?.userId; // Attempt to get userId from subscription metadata
      const customer = await stripe.customers.retrieve(subObject.customer as string) as Stripe.Customer;
      const customerUserId = customer.metadata?.userId; // Fallback to customer metadata if not in subscription

      const finalUserId = subscriptionUserId || customerUserId; // Determine the associated user ID

      if (!finalUserId) {
        logger.error('Missing userId in subscription or customer metadata for updated/deleted event.');
        return res.status(400).send('Missing user ID in event.');
      }

      try {
        if (event.type === 'customer.subscription.deleted') {
          // If subscription is deleted in Stripe, remove it from our database
          const { error } = await supabase.from('user_subscriptions').delete().eq('id', subObject.id);
          if (error) {
            logger.error('Supabase delete error for customer.subscription.deleted:', error);
            return res.status(500).send('Supabase delete failed.');
          }
        } else { // customer.subscription.updated
          // Update the existing subscription record in our database
          const { error } = await supabase.from('user_subscriptions').upsert({
            id: subObject.id,
            user_id: finalUserId,
            status: subObject.status,
            current_period_start: new Date((subObject as any).current_period_start * 1000).toISOString(),
            current_period_end: new Date((subObject as any).current_period_end * 1000).toISOString(),
            product_id: subObject.items.data[0].price?.product as string,
            price_id: subObject.items.data[0].price?.id,
            customer_id: subObject.customer as string,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' }); // Conflict on 'id' means update if exists

          if (error) {
            logger.error('Supabase upsert error for customer.subscription.updated:', error);
            return res.status(500).send('Supabase upsert failed.');
          }
        }
        // The 'update_profile_premium_status' RLS trigger in Supabase automatically
        // updates the 'profiles.is_premium' field based on the subscription status.
      } catch (e) {
        logger.error(`Error processing ${event.type}:`, e);
        return res.status(500).send('Webhook handler failed.');
      }
      break;

    default:
      logger.warn(`Unhandled event type ${event.type}`); // Log unhandled event types
  }

  // Return a 200 response to Stripe to acknowledge successful receipt of the event
  res.json({ received: true });
};