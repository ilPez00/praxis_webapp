# 🇮🇹 Stripe Setup Guide for Praxis (Italy)

**Last Updated:** 2026-03-16
**Status:** ✅ Ready to deploy

---

## Quick Start (15 minutes)

### Step 1: Create Stripe Account (5 min)

1. Go to [stripe.com](https://stripe.com)
2. Click "Sign up" → Use your email (gio@praxis.app or personal)
3. **Country:** Italy 🇮🇹
4. **Business type:** Individual/Sole proprietor (you're unemployed, start as individual)
5. **Business details:**
   - Name: Gio [Your Last Name]
   - Address: Your Verona address
   - Phone: Your Italian phone number
   - Tax ID: Codice Fiscale (required for Italy)

**Bank Account:**

- Add your Italian bank account (IBAN)
- Stripe will make 2 small deposits in 2-3 days to verify
- **For now:** You can test with test mode without verified bank account

---

## Step 2: Create Products & Prices (5 min)

### In Stripe Dashboard:

1. Go to **Products** → **Add product**

#### Product 1: Praxis Pro

```
Name: Praxis Pro
Description: Unlimited goals, AI coaching, mutual streaks

Pricing:
  - Recurring (subscription)
  - Billing period: Monthly

Price: €9.99/month
Currency: EUR (Euro)

Trial period: 7 days (optional, recommended for launch)
```

**Save the Price ID** → Looks like: `price_1QXabc123DEF456`

#### Product 2: Praxis Elite

```
Name: Praxis Elite
Description: Priority matching, streak shield, advanced analytics

Pricing:
  - Recurring (subscription)
  - Billing period: Monthly

Price: €24.99/month
Currency: EUR (Euro)

Trial period: 7 days
```

**Save the Price ID** → Looks like: `price_1QXghi789JKL012`

#### Optional: Add Annual Pricing

For each product, add a second price:

**Praxis Pro Annual:**

- Price: €79.99/year (33% savings vs monthly)
- Billing period: Yearly

**Praxis Elite Annual:**

- Price: €199.99/year (33% savings vs monthly)

---

## Step 3: Configure Environment Variables (2 min)

### Edit `/home/gio/Praxis/praxis_webapp/.env`

```bash
# Stripe Backend Configuration
STRIPE_SECRET_KEY=sk_test_51QX...your_test_secret_key
STRIPE_WEBHOOK_SECRET=whsec_...your_webhook_signing_secret
STRIPE_PRICE_ID=price_1QXabc123DEF456  # Pro Monthly Price ID

# App URLs
CLIENT_URL=http://localhost:3000
PORT=3001
```

### Where to Find Each:

**STRIPE_SECRET_KEY:**

1. Stripe Dashboard → Developers → API keys
2. Copy "Secret key" (starts with `sk_test_` in test mode)

**STRIPE_WEBHOOK_SECRET:**

1. Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. Endpoint URL: `https://your-railway-url.railway.app/api/stripe/webhook`
   - For local testing: Use Stripe CLI (see below)
4. Select events to send:
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
5. Copy "Signing secret" → Looks like `whsec_...`

**STRIPE_PRICE_ID:**

- From Step 2, copy the Price ID for "Praxis Pro Monthly"

---

## Step 4: Test Locally with Stripe CLI (3 min)

### Install Stripe CLI:

```bash
# Ubuntu/Debian (Verona Linux setup)
curl -s https://packages.stripe.dev/api/security/keypair/stripe-cli-gpg/public | gpg --dearmor | sudo tee /usr/share/keyrings/stripe.gpg
echo "deb [signed-by=/usr/share/keyrings/stripe.gpg] https://packages.stripe.dev/stripe-cli-debian-local stable main" | sudo tee -a /etc/apt/sources.list.d/stripe.list
sudo apt update
sudo apt install stripe
```

### Login to Stripe CLI:

```bash
stripe login
```

### Forward Webhooks to Localhost:

```bash
# In a new terminal (keep running while testing)
stripe listen --forward-to localhost:3001/api/stripe/webhook
```

**Output:**

```
Ready! Your webhook signing secret is whsec_1234567890abcdef
```

**Copy this secret** → Add to `.env` as `STRIPE_WEBHOOK_SECRET`

### Trigger Test Events:

```bash
# Simulate a successful payment
stripe trigger checkout.session.completed

# Simulate subscription creation
stripe trigger customer.subscription.created

# Simulate subscription cancellation
stripe trigger customer.subscription.deleted
```

---

## Step 5: Update Frontend Configuration

### Edit `/home/gio/Praxis/praxis_webapp/client/src/lib/api.ts`

Ensure the API URL is correct:

```typescript
export const API_URL =
  process.env.REACT_APP_API_URL || "http://localhost:3001/api";
```

### Edit `/home/gio/Praxis/praxis_webapp/client/.env`

```bash
REACT_APP_SUPABASE_URL=https://your-project-id.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJ...your_anon_key
REACT_APP_API_URL=http://localhost:3001/api  # For local testing
```

**For production (Vercel):**

```bash
REACT_APP_API_URL=https://your-railway-url.railway.app/api
```

---

## Step 6: Test the Full Flow

### 1. Start Backend:

```bash
cd /home/gio/Praxis/praxis_webapp
npm run dev
```

### 2. Start Frontend:

```bash
cd /home/gio/Praxis/praxis_webapp/client
npm start
```

### 3. Test Checkout:

1. Open browser: `http://localhost:3000`
2. Navigate to Settings → Upgrade to Pro
3. Click "Subscribe" → Should redirect to Stripe Checkout
4. **Test Card:** Use Stripe test cards:
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`
   - Any future date for expiry
   - Any 3 digits for CVC

### 4. Verify Webhook:

Check backend logs for:

```
info: Stripe Webhook Event Received: checkout.session.completed
info: Credited premium access to user [userId]
```

Check database:

```sql
-- In Supabase SQL Editor
SELECT * FROM user_subscriptions WHERE user_id = 'your-user-id';
SELECT * FROM profiles WHERE id = 'your-user-id';
```

---

## 🇮🇹 Italy-Specific Configuration

### Tax (IVA/VAT)

**As a sole proprietor (individual):**

1. **Regime Forfettario** (most likely for you):
   - Flat tax 5% for first 5 years (if new business)
   - No IVA charged (you're exempt)
   - Revenue limit: €85,000/year

2. **Stripe Tax Configuration:**
   - Dashboard → Settings → Tax
   - **Business model:** Reverse charge (for digital services)
   - **EU VAT MOSS:** Stripe handles automatically
   - **Italian customers:** No IVA added (you're exempt under forfettario)

**Important:** Consult a commercialista (accountant) in Verona for:

- Partita IVA opening (required if revenue > €5,000/year)
- Regime forfettario application
- INPS Gestione Separata contributions (~26% of net income)

### Pricing in Euro

**Recommended launch pricing:**

| Tier  | Monthly | Annual  | USD Equivalent   |
| ----- | ------- | ------- | ---------------- |
| Free  | €0      | €0      | $0               |
| Pro   | €9.99   | €79.99  | $9.99 / $79.99   |
| Elite | €24.99  | €199.99 | $24.99 / $199.99 |

**Psychology:**

- €9.99 = "less than a pizza" (easy yes)
- €79.99 annual = "less than €7/month" (value anchor)
- €24.99 = "premium but accessible" (aspirational)

### Customer Support (Italian)

**Required by EU law:**

- Email address for support
- Response within 14 days (EU consumer rights)
- 14-day refund policy (mandatory for EU digital products)

**Add to Terms:**

```
Diritto di recesso: Hai 14 giorni per richiedere un rimborso completo.
Contattaci a: support@praxis.app
```

---

## Production Deployment

### Railway (Backend):

1. **Add Environment Variables:**
   - Railway Dashboard → Your Project → Variables
   - Add: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`

2. **Deploy:**

   ```bash
   git push origin main
   # Railway auto-deploys
   ```

3. **Get Production URL:**
   - Railway gives you: `https://praxis-webapp-production.up.railway.app`

### Vercel (Frontend):

1. **Add Environment Variables:**
   - Vercel Dashboard → Project → Settings → Environment Variables
   - Add: `REACT_APP_API_URL` = Railway production URL

2. **Deploy:**
   ```bash
   cd client
   vercel --prod
   ```

### Stripe Webhook (Production):

1. **Update Webhook Endpoint:**
   - Stripe Dashboard → Developers → Webhooks
   - Edit endpoint URL: `https://praxis-webapp-production.up.railway.app/api/stripe/webhook`

2. **Copy Production Webhook Secret:**
   - Different from local CLI secret!
   - Add to Railway: `STRIPE_WEBHOOK_SECRET`

---

## Testing Checklist

### Before Launch:

- [ ] Test card `4242 4242 4242 4242` completes successfully
- [ ] Webhook fires and updates database
- [ ] User gets premium access immediately
- [ ] Cancellation flow works
- [ ] Refund flow works (Stripe Dashboard → Refund)
- [ ] Email receipts are sent (Stripe → Settings → Emails)
- [ ] Italian pricing displays correctly (€, not €)
- [ ] Annual vs monthly toggle works
- [ ] Free tier limits are enforced (3 goals, 5 matches)
- [ ] Pro features unlock after payment

### Test Scenarios:

```bash
# 1. Successful subscription
stripe trigger checkout.session.completed \
  --add payment_intent:status:succeeded

# 2. Failed payment
stripe trigger payment_intent.payment_failed \
  --add payment_intent:status:requires_payment_method

# 3. Subscription cancellation
stripe trigger customer.subscription.deleted

# 4. Subscription update (upgrade/downgrade)
stripe trigger customer.subscription.updated
```

---

## Going Live (Test → Production)

### 1. Switch Stripe to Live Mode:

1. Stripe Dashboard → Toggle "Test Mode" → OFF
2. Create NEW products in live mode (same as test mode)
3. Copy live Price IDs

### 2. Update Environment Variables:

```bash
# .env (production)
STRIPE_SECRET_KEY=sk_live_51QX...  # Live secret key
STRIPE_WEBHOOK_SECRET=whsec_...     # Live webhook secret
STRIPE_PRICE_ID=price_1QX...        # Live Price ID
```

### 3. Deploy to Production:

```bash
# Railway
railway up --prod

# Vercel
vercel --prod
```

### 4. Test with Real Card:

- Use your actual credit card (€9.99)
- Verify charge appears in Stripe Dashboard
- Verify you can refund yourself

---

## Revenue Tracking

### Stripe Dashboard Metrics:

1. **MRR (Monthly Recurring Revenue):**
   - Dashboard → Reports → MRR
   - Track weekly

2. **Churn Rate:**
   - Dashboard → Reports → Churn
   - Target: < 5% monthly

3. **Active Subscriptions:**
   - Dashboard → Customers → Subscriptions
   - Count active vs. canceled

### Manual Tracking (Google Sheet):

Use the `ANALYTICS_DASHBOARD_TEMPLATE.md` file to track:

- Daily MRR
- New subscriptions
- Cancellations
- Refunds

---

## Common Issues & Fixes

### Issue: Webhook not firing

**Fix:**

1. Check Railway logs: `railway logs`
2. Verify webhook URL is correct in Stripe Dashboard
3. Test locally with Stripe CLI first
4. Check CORS settings in backend

### Issue: Payment fails with "Card declined"

**Fix:**

1. Use test card `4242 4242 4242 4242` in test mode
2. In live mode, try a different card
3. Check Stripe Dashboard → Payments for decline reason

### Issue: User doesn't get premium access

**Fix:**

1. Check webhook logs in Railway
2. Verify `user_subscriptions` table has new row
3. Check Supabase RLS policies allow insert
4. Verify `update_profile_premium_status` trigger exists

### Issue: Euro symbol displays wrong

**Fix:**

```typescript
// Frontend: Format currency correctly
const formatPrice = (price: number) => {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(price);
};

// Usage:
formatPrice(9.99); // "9,99 €"
```

---

## Italian Tax Compliance Checklist

### Before First €1:

- [ ] Open Partita IVA (if expecting > €5,000/year)
- [ ] Register with INPS Gestione Separata
- [ ] Choose commercialista in Verona
- [ ] Set up separate bank account for business
- [ ] Register for VIES (EU VAT exchange) if selling to other EU countries

### Monthly:

- [ ] Download Stripe transaction report
- [ ] Send to commercialista
- [ ] Pay INPS contributions (quarterly)
- [ ] File F24 form (tax payments)

### Annual:

- [ ] File Modello Redditi (tax return)
- [ ] Pay regime forfettario tax (5% or 15%)
- [ ] Submit IVA declaration (if applicable)
- [ ] Renew INPS registration

**Recommended Commercialisti in Verona:**

- Studio Commercialista Verona (search Google Maps)
- Ask for referral from other indie hackers in Italy
- Cost: €500-1,500/year for forfettario

---

## Launch Checklist

### Day -7 (One Week Before):

- [ ] All test scenarios pass
- [ ] Webhook works in production
- [ ] Email receipts configured
- [ ] Terms & Privacy Policy updated (GDPR compliant)
- [ ] Support email set up (support@praxis.app)

### Day -1:

- [ ] Switch Stripe to live mode
- [ ] Update all environment variables
- [ ] Deploy to production
- [ ] Test with real credit card
- [ ] Refund yourself

### Day 0 (Launch):

- [ ] Post on Twitter/LinkedIn
- [ ] Email beta users: "Pro tier is live!"
- [ ] Monitor Stripe Dashboard for first payment
- [ ] Celebrate first €9.99 🎉

### Day +1 to +7:

- [ ] Check MRR daily
- [ ] Respond to support emails within 24h
- [ ] Track conversion rate (free → pro)
- [ ] Iterate on pricing if conversion < 2%

---

## Support & Resources

### Stripe Documentation:

- [Stripe Payments](https://stripe.com/docs/payments)
- [Stripe Subscriptions](https://stripe.com/docs/billing/subscriptions)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)

### Italian Resources:

- [Agenzia delle Entrate](https://www.agenziaentrate.gov.it/)
- [INPS Gestione Separata](https://www.inps.it/)
- [Regime Forfettario Guide](https://www.bussola24.it/regime-forfettario/)

### Community:

- Indie Hackers Italia (Facebook group)
- Build in Public Italia (Discord)
- r/forfettario (Reddit)

---

## Quick Reference: Test Cards

| Card Number           | Purpose                             |
| --------------------- | ----------------------------------- |
| `4242 4242 4242 4242` | Success                             |
| `4000 0000 0000 0002` | Declined                            |
| `4000 0025 0000 0003` | Requires authentication (3D Secure) |
| `4000 0000 0000 9995` | Declined (insufficient funds)       |

**Expiry:** Any future date  
**CVC:** Any 3 digits  
**ZIP:** Any 5 digits

---

## 🚀 Next Steps

1. **Today:** Create Stripe account, add products
2. **Tomorrow:** Test locally with Stripe CLI
3. **Day 3:** Deploy to production, test with real card
4. **Day 4:** Launch to beta users
5. **Day 7:** First paying customers!

**Goal:** €1,000 MRR by Day 30 = 100 Pro users

---

**Buona fortuna, Gio! 🥋**
