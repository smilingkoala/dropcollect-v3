# Setting Up Lemon Squeezy (10 minutes)

## Step 1 — Create your Lemon Squeezy account
1. Go to https://app.lemonsqueezy.com/register
2. Sign up with your email — no personal verification needed yet
3. You can start accepting payments right away in test mode

---

## Step 2 — Create your Store
1. After signup, go to Settings → Stores
2. Click "Add store"
3. Give it a name like "DropCollect"
4. Copy your **Store ID** — you'll need it (it's a number like `12345`)

---

## Step 3 — Create Products

### Pro Plan ($7/month)
1. Go to Products → Add product
2. Name: "DropCollect Pro"
3. Description: "Unlimited emails, email notifications"
4. Pricing: Recurring → $7 → Monthly
5. Click Save
6. Click into the product → click the **variant** → copy the **Variant ID** (a number)

### Pro Plus Plan ($19/month)
1. Repeat above — name "DropCollect Pro Plus"
2. Price: $19/month
3. Copy that **Variant ID** too

---

## Step 4 — Get your API Key
1. Go to Settings → API
2. Click "Add API key" → name it "dropcollect-server"
3. Copy the key — starts with `eyJ...`

---

## Step 5 — Set up Webhook
1. Go to Settings → Webhooks
2. Click "Add webhook"
3. URL: `https://YOUR-VERCEL-URL.vercel.app/api/webhook`
4. Events to subscribe to (check all of these):
   - `subscription_created`
   - `subscription_cancelled`
   - `subscription_expired`
   - `subscription_paused`
   - `subscription_resumed`
   - `subscription_payment_failed`
5. Copy the **Signing Secret** shown

---

## Step 6 — Add Environment Variables in Vercel

Go to your Vercel project → Settings → Environment Variables and add:

| Name                  | Value                          |
|-----------------------|--------------------------------|
| `LS_API_KEY`          | your `eyJ...` API key          |
| `LS_STORE_ID`         | your store ID number           |
| `LS_VARIANT_PRO`      | variant ID for $7/mo product   |
| `LS_VARIANT_PRO_PLUS` | variant ID for $19/mo product  |
| `LS_WEBHOOK_SECRET`   | signing secret from webhook    |
| `RESEND_API_KEY`      | from resend.com (free tier)    |

---

## Step 7 — Run Supabase Migration
Open `supabase-migration-pro.sql` → paste into Supabase SQL Editor → Run

---

## Step 8 — Redeploy
Push any change to GitHub and Vercel will redeploy automatically.

---

## Testing Payments
Lemon Squeezy has a test mode — use card number `4242 4242 4242 4242`
with any future expiry and any CVV to test a payment without real money.

---

## Going Live
When you're ready to accept real money:
1. Go to Settings → Payouts
2. Add your bank account or PayPal
3. That's when they verify your identity (but only for payouts)
