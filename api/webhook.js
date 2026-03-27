// api/webhook.js — POST /api/webhook
// Handles Lemon Squeezy webhook events
// Register this URL in LS Dashboard → Settings → Webhooks
// Docs: https://docs.lemonsqueezy.com/help/webhooks

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { sendNewSubscriberNotification } = require('./notify');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Lemon Squeezy sends the raw body — we need it for signature verification
// Vercel body parser must be disabled for this route (see config export below)
function verifySignature(rawBody, signature) {
  if (!process.env.LS_WEBHOOK_SECRET || !signature) return false;
  const hmac = crypto.createHmac('sha256', process.env.LS_WEBHOOK_SECRET);
  hmac.update(rawBody);
  const digest = hmac.digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

async function upgradeCollector(collectorId, tier, notifyEmail, lsCustomerId, lsSubscriptionId) {
  const { error } = await supabase
    .from('collectors')
    .update({
      tier,
      email_cap: null,          // unlimited
      notify_email: notifyEmail || null,
      ls_customer_id: lsCustomerId,
      ls_subscription_id: lsSubscriptionId,
      upgraded_at: new Date().toISOString(),
    })
    .eq('id', collectorId);

  if (error) {
    console.error('Supabase upgrade error:', error);
    return false;
  }
  console.log(`✅ Upgraded collector ${collectorId} to ${tier}`);
  return true;
}

async function downgradeCollector(lsCustomerId) {
  const { data: collectors } = await supabase
    .from('collectors')
    .select('id, notify_email')
    .eq('ls_customer_id', lsCustomerId);

  if (!collectors?.length) return;

  for (const c of collectors) {
    await supabase
      .from('collectors')
      .update({
        tier: 'free',
        email_cap: 200,
        ls_subscription_id: null,
        upgraded_at: null,
      })
      .eq('id', c.id);
    console.log(`⬇️  Downgraded collector ${c.id} to free`);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Get raw body for signature verification
  const rawBody = req.body;
  const signature = req.headers['x-signature'];

  if (!verifySignature(rawBody, signature)) {
    console.error('Webhook signature verification failed');
    return res.status(401).json({ error: 'Invalid signature.' });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body.' });
  }

  const eventName = event?.meta?.event_name;
  const customData = event?.meta?.custom_data || {};
  const attrs = event?.data?.attributes || {};

  console.log(`[Webhook] Received: ${eventName}`);

  switch (eventName) {

    // ✅ New subscription created (payment succeeded)
    case 'subscription_created': {
      const { collector_id, tier, notify_email } = customData;
      if (!collector_id || !tier) {
        console.error('Missing custom_data in webhook:', customData);
        break;
      }

      const ok = await upgradeCollector(
        collector_id,
        tier,
        notify_email,
        String(attrs.customer_id || ''),
        String(event?.data?.id || ''),
      );

      // Send confirmation email
      if (ok && notify_email) {
        const { Resend } = require('resend');
        const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
        if (resend) {
          const tierLabel = tier === 'pro_plus' ? 'Pro Plus' : 'Pro';
          await resend.emails.send({
            from: 'DropCollect <hello@dropcollect.io>',
            to: notify_email,
            subject: `🎉 You're now on ${tierLabel} — unlimited emails activated`,
            html: `
              <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
                <h2>You're on ${tierLabel}! 🎉</h2>
                <p style="color:#555;margin-bottom:24px;">
                  Your collector <strong>${collector_id}</strong> now has unlimited email collection. 
                  The cap has been removed and email notifications are active.
                </p>
                <a href="https://dropcollect.io/dashboard.html?id=${collector_id}"
                   style="display:inline-block;padding:12px 24px;background:#4dffcc;color:#1a1a2e;border-radius:8px;font-weight:700;text-decoration:none;">
                  View Your Dashboard →
                </a>
                <p style="color:#aaa;font-size:12px;margin-top:32px;">
                  Manage your subscription at 
                  <a href="https://app.lemonsqueezy.com/my-orders" style="color:#aaa;">Lemon Squeezy</a>
                </p>
              </div>
            `,
          }).catch(e => console.error('Confirmation email failed:', e.message));
        }
      }
      break;
    }

    // 🔄 Subscription resumed after pause
    case 'subscription_resumed': {
      const { collector_id, tier, notify_email } = customData;
      if (collector_id && tier) {
        await upgradeCollector(
          collector_id, tier, notify_email,
          String(attrs.customer_id || ''),
          String(event?.data?.id || ''),
        );
      }
      break;
    }

    // ❌ Subscription cancelled or expired — downgrade to free
    case 'subscription_cancelled':
    case 'subscription_expired': {
      const customerId = String(attrs.customer_id || '');
      if (customerId) await downgradeCollector(customerId);
      break;
    }

    // ⏸ Subscription paused — downgrade temporarily
    case 'subscription_paused': {
      const customerId = String(attrs.customer_id || '');
      if (customerId) await downgradeCollector(customerId);
      break;
    }

    // 💳 Payment failed — log it
    case 'subscription_payment_failed': {
      console.warn(`Payment failed for customer ${attrs.customer_id}`);
      // Lemon Squeezy retries automatically — no action needed unless you want to email user
      break;
    }

    default:
      console.log(`Unhandled LS event: ${eventName}`);
  }

  // Always return 200 so LS doesn't retry
  return res.status(200).json({ received: true });
};

// Disable Vercel's body parser — we need the raw string for HMAC verification
module.exports.config = {
  api: { bodyParser: false },
};
