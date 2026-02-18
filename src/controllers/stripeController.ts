import { Request, Response } from 'express';
import Stripe from 'stripe';
import { supabase } from '../lib/supabaseClient'; // Assuming supabase client is configured

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2026-01-28.clover' as any, // Use the version requested by TS for now
});

export const createCheckoutSession = async (req: Request, res: Response) => {
  const { userId, email } = req.body; // Expect userId and email from frontend

  if (!userId || !email) {
    return res.status(400).json({ error: 'User ID and email are required to create a checkout session.' });
  }

  const priceId = process.env.STRIPE_PRICE_ID;

  if (!priceId) {
    console.error('STRIPE_PRICE_ID is not set in environment variables.');
    return res.status(500).json({ error: 'Server configuration error: Stripe Price ID missing.' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/cancel`,
      client_reference_id: userId, // Link this session to our user
      customer_email: email, // Pre-fill customer email
      metadata: {
        userId: userId, // Also add to metadata for easier webhook processing
      },
    });

    res.status(200).json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Error creating Stripe checkout session:', error);
    res.status(500).json({ error: error.message });
  }
};

export const handleWebhook = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set in environment variables.');
    return res.status(500).send('Webhook secret not configured.');
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig as string, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('Stripe Webhook Event Received:', event.type);

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as Stripe.Checkout.Session;
      // Retrieve customer and subscription information
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;
      const userId = session.metadata?.userId;
      // Ensure product and price IDs are explicitly fetched or derived
      // Note: session.line_items is often null/undefined on completed sessions for subscriptions.
      // We should retrieve the subscription object to get accurate price/product details.

      if (!userId || !subscriptionId || !customerId) {
        console.error('Missing critical data in checkout.session.completed event:', { userId, subscriptionId, customerId });
        return res.status(400).send('Missing critical data in event.');
      }

      try {
        const fullSubscription = await stripe.subscriptions.retrieve(subscriptionId) as Stripe.Subscription;
        const priceId = fullSubscription.items.data[0].price?.id;
        const productId = fullSubscription.items.data[0].price?.product as string;

        if (!priceId || !productId) {
          console.error('Could not retrieve price or product ID from full subscription object.');
          return res.status(500).send('Failed to get subscription details.');
        }

        const { error } = await supabase.from('user_subscriptions').upsert({
          id: fullSubscription.id,
          user_id: userId,
          status: fullSubscription.status,
          current_period_start: new Date((fullSubscription as any).current_period_start * 1000).toISOString(),
          current_period_end: new Date((fullSubscription as any).current_period_end * 1000).toISOString(),
          product_id: productId,
          price_id: priceId,
          customer_id: customerId,
          created_at: new Date(fullSubscription.created * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

        if (error) {
          console.error('Supabase upsert error for checkout.session.completed:', error);
          return res.status(500).send('Supabase upsert failed.');
        }

        // The RLS trigger will automatically update profiles.is_premium

      } catch (e) {
        console.error('Error processing checkout.session.completed:', e);
        return res.status(500).send('Webhook handler failed.');
      }
      break;

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      const subObject = event.data.object as Stripe.Subscription; // Explicitly type
      const subscriptionUserId = subObject.metadata?.userId; // Get userId from subscription metadata
      const customer = await stripe.customers.retrieve(subObject.customer as string) as Stripe.Customer;
      const customerUserId = customer.metadata?.userId; // Fallback to customer metadata

      const finalUserId = subscriptionUserId || customerUserId;

      if (!finalUserId) {
        console.error('Missing userId in subscription or customer metadata for updated/deleted event.');
        return res.status(400).send('Missing user ID in event.');
      }

      try {
        if (event.type === 'customer.subscription.deleted') {
          // Delete the subscription record from our database
          const { error } = await supabase.from('user_subscriptions').delete().eq('id', subObject.id);
          if (error) {
            console.error('Supabase delete error for customer.subscription.deleted:', error);
            return res.status(500).send('Supabase delete failed.');
          }
        } else { // customer.subscription.updated
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
          }, { onConflict: 'id' });

          if (error) {
            console.error('Supabase upsert error for customer.subscription.updated:', error);
            return res.status(500).send('Supabase upsert failed.');
          }
        }
        // The RLS trigger will automatically update profiles.is_premium
      } catch (e) {
        console.error(`Error processing ${event.type}:`, e);
        return res.status(500).send('Webhook handler failed.');
      }
      break;

    default:
      console.warn(`Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  res.json({ received: true });
};