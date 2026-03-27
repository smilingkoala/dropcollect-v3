// api/collect.js — POST /api/collect
// Accepts email submissions from the embedded widget
const { createClient } = require('@supabase/supabase-js');
const { sendNewSubscriberNotification } = require('./notify');
const { validateEmail } = require('./validate-email');
const { runBotProtection, getIP } = require('./bot-protection');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id, email } = req.body || {};

  // ── 1. Basic input presence check ───────────────────────
  if (!id || typeof id !== 'string' || !/^[a-z0-9]{4,16}$/.test(id)) {
    return res.status(400).json({ error: 'Invalid collector id.' });
  }

  // ── 2. Bot protection ────────────────────────────────────
  const botCheck = runBotProtection(req, id);
  if (!botCheck.allowed) {
    if (botCheck.silent) {
      // Return fake success to fool bots
      return res.status(200).json({ success: true });
    }
    if (botCheck.retryAfter) {
      res.setHeader('Retry-After', botCheck.retryAfter);
    }
    return res.status(botCheck.statusCode).json({ error: botCheck.error });
  }

  // ── 3. Email validation ──────────────────────────────────
  const emailCheck = validateEmail(email);
  if (!emailCheck.valid) {
    return res.status(400).json({
      error: emailCheck.error,
      // Surface typo suggestion to widget so it can show "Did you mean X?"
      ...(emailCheck.suggestion && { suggestion: emailCheck.suggestion }),
    });
  }

  const cleanEmail = email.trim().toLowerCase();

  // ── 4. Fetch collector ───────────────────────────────────
  const { data: collector, error: collErr } = await supabase
    .from('collectors')
    .select('id, email_cap, tier, notify_email, headline')
    .eq('id', id)
    .single();

  if (collErr || !collector) {
    return res.status(404).json({ error: 'Collector not found.' });
  }

  // ── 5. Capacity check ────────────────────────────────────
  if (collector.email_cap !== null) {
    const { count, error: countErr } = await supabase
      .from('emails')
      .select('*', { count: 'exact', head: true })
      .eq('collector_id', id);

    if (!countErr && count >= collector.email_cap) {
      return res.status(429).json({ error: 'capacity_reached' });
    }
  }

  // ── 6. Duplicate check ───────────────────────────────────
  const { data: existing } = await supabase
    .from('emails')
    .select('id')
    .eq('collector_id', id)
    .eq('email', cleanEmail)
    .maybeSingle();

  if (existing) {
    return res.status(409).json({ error: 'already_subscribed' });
  }

  // ── 7. Insert ────────────────────────────────────────────
  const { error: insertErr } = await supabase.from('emails').insert({
    collector_id: id,
    email: cleanEmail,
    collected_at: new Date().toISOString(),
    ip: getIP(req),
  });

  if (insertErr) {
    console.error('Email insert error:', insertErr);
    return res.status(500).json({ error: 'Failed to save email.' });
  }

  // ── 8. Notification (non-blocking) ───────────────────────
  if (collector.tier !== 'free' && collector.notify_email) {
    sendNewSubscriberNotification({
      collectorId: id,
      newEmail: cleanEmail,
      notifyEmail: collector.notify_email,
      headline: collector.headline,
    });
  }

  return res.status(201).json({
    success: true,
    // Return warning to widget (e.g. role-based address) — not an error, just informational
    ...(emailCheck.warning && { warning: emailCheck.warning }),
  });
};
