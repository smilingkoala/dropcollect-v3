// api/create.js — POST /api/create
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const TIER_CAPS = {
  free: 200,
  pro: null,
  pro_plus: null,
};

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,}$/;

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
    ownerEmail = '',
  } = req.body || {};

  const validTiers = ['free', 'pro', 'pro_plus'];
  const safeTier = validTiers.includes(tier) ? tier : 'free';
  const safeStyle = ['minimal', 'card'].includes(style) ? style : 'minimal';
  const safe = (s, max = 120) => String(s || '').slice(0, max).replace(/[<>]/g, '');

  // Validate owner email if provided
  const cleanOwnerEmail = ownerEmail?.trim().toLowerCase() || null;
  const safeOwnerEmail = (cleanOwnerEmail && EMAIL_RE.test(cleanOwnerEmail))
    ? cleanOwnerEmail
    : null;

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
    owner_email: safeOwnerEmail,   // platform owner can see this
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
