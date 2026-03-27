// api/collect.js — POST /api/collect
// Accepts email submissions from the embedded widget
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,}$/;

module.exports = async function handler(req, res) {
  // CORS — widget runs on third-party sites, must allow all origins
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id, email } = req.body || {};

  // Basic validation
  if (!id || typeof id !== 'string' || !/^[a-z0-9]{4,16}$/.test(id)) {
    return res.status(400).json({ error: 'Invalid collector id.' });
  }
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required.' });
  }
  const cleanEmail = email.trim().toLowerCase();
  if (!EMAIL_RE.test(cleanEmail) || cleanEmail.length > 320) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  // Fetch collector
  const { data: collector, error: collErr } = await supabase
    .from('collectors')
    .select('id, email_cap, tier')
    .eq('id', id)
    .single();

  if (collErr || !collector) {
    return res.status(404).json({ error: 'Collector not found.' });
  }

  // Check capacity
  if (collector.email_cap !== null) {
    const { count, error: countErr } = await supabase
      .from('emails')
      .select('*', { count: 'exact', head: true })
      .eq('collector_id', id);

    if (!countErr && count >= collector.email_cap) {
      return res.status(429).json({
        error: 'capacity_reached',
        message: "This collector has reached its email cap.",
      });
    }
  }

  // Check for duplicate
  const { data: existing } = await supabase
    .from('emails')
    .select('id')
    .eq('collector_id', id)
    .eq('email', cleanEmail)
    .maybeSingle();

  if (existing) {
    return res.status(409).json({
      error: 'already_subscribed',
      message: 'This email is already on the list.',
    });
  }

  // Insert the email
  const { error: insertErr } = await supabase.from('emails').insert({
    collector_id: id,
    email: cleanEmail,
    collected_at: new Date().toISOString(),
    // Capture IP for abuse detection (stored but not exposed to dashboard)
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress,
  });

  if (insertErr) {
    console.error('Email insert error:', insertErr);
    return res.status(500).json({ error: 'Failed to save email.' });
  }

  return res.status(201).json({ success: true });
};
