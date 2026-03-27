// api/create.js — POST /api/create
// Creates a new collector, returns id, dashboardUrl, snippet
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const TIER_CAPS = {
  free: 200,
  pro: null,       // unlimited
  pro_plus: null,  // unlimited
};

function randomId(len = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    style = 'minimal',
    headline = 'Stay in the loop',
    subheadline = 'Get updates in your inbox',
    buttonLabel = 'Subscribe',
    buttonColor = '#4dffcc',
    tier = 'free',
  } = req.body || {};

  // Validate tier
  const validTiers = ['free', 'pro', 'pro_plus'];
  const safeTier = validTiers.includes(tier) ? tier : 'free';

  // Validate style
  const safeStyle = ['minimal', 'card'].includes(style) ? style : 'minimal';

  // Sanitize strings
  const safe = (s, max = 120) => String(s || '').slice(0, max).replace(/[<>]/g, '');

  const id = randomId(8);
  const emailCap = TIER_CAPS[safeTier];

  const { error } = await supabase.from('collectors').insert({
    id,
    tier: safeTier,
    widget_style: safeStyle,
    headline: safe(headline),
    subheadline: safe(subheadline),
    button_label: safe(buttonLabel, 40),
    button_color: /^#[0-9a-fA-F]{6}$/.test(buttonColor) ? buttonColor : '#4dffcc',
    email_cap: emailCap,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error('Supabase insert error:', error);
    return res.status(500).json({ error: 'Failed to create collector.' });
  }

  const origin = `https://${req.headers.host}`;

  return res.status(201).json({
    id,
    tier: safeTier,
    emailCap,
    dashboardUrl: `${origin}/dashboard.html?id=${id}`,
    snippet: `<script src="${origin}/c.js?id=${id}"><\/script>`,
  });
};
