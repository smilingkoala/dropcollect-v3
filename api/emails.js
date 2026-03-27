// api/emails.js — GET /api/emails?id=xxx
// Returns emails for a collector dashboard (no auth — security by obscurity of collector ID)
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const id = req.query?.id;
  if (!id || !/^[a-z0-9]{4,16}$/.test(id)) {
    return res.status(400).json({ error: 'Missing or invalid collector id.' });
  }

  // Fetch collector
  const { data: collector, error: collErr } = await supabase
    .from('collectors')
    .select('id, tier, widget_style, headline, subheadline, button_label, button_color, email_cap, created_at')
    .eq('id', id)
    .single();

  if (collErr || !collector) {
    return res.status(404).json({ error: 'Collector not found.' });
  }

  // Fetch emails — we deliberately do NOT return IP addresses to the dashboard
  const { data: emails, error: emailErr, count } = await supabase
    .from('emails')
    .select('email, collected_at', { count: 'exact' })
    .eq('collector_id', id)
    .order('collected_at', { ascending: false })
    .limit(10000);

  if (emailErr) {
    console.error('Emails fetch error:', emailErr);
    return res.status(500).json({ error: 'Failed to fetch emails.' });
  }

  return res.status(200).json({
    collector,
    emails: emails || [],
    count: count ?? (emails?.length || 0),
  });
};
