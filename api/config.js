// api/config.js — GET /api/config?id=xxx
// Returns only public-safe config fields needed to render the widget.
// Called by c.js on third-party sites — must allow CORS.
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const id = req.query?.id;
  if (!id || !/^[a-z0-9]{4,16}$/.test(id)) {
    return res.status(400).json({ error: 'Missing or invalid id.' });
  }

  const { data, error } = await supabase
    .from('collectors')
    .select('widget_style, headline, subheadline, button_label, button_color, email_cap, tier')
    .eq('id', id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Collector not found.' });
  }

  // Only return fields the widget needs to render
  return res.status(200).json({
    widget_style: data.widget_style,
    headline: data.headline,
    subheadline: data.subheadline,
    button_label: data.button_label,
    button_color: data.button_color,
    // Let widget know if at cap (don't expose exact count)
    email_cap: data.email_cap,
    tier: data.tier,
  });
};
