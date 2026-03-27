// api/admin/collectors.js — GET /api/admin/collectors
// Returns all collectors + email counts for the admin dashboard
// Protected by ADMIN_SECRET env var — never expose this URL publicly

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function checkAuth(req) {
  const key = req.headers['x-admin-key'];
  if (!key || key !== process.env.ADMIN_SECRET) return false;
  return true;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (!checkAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  if (req.method !== 'GET') return res.status(405).end();

  // Fetch all collectors
  const { data: collectors, error: collErr } = await supabase
    .from('collectors')
    .select(`
      id, tier, widget_style, headline, subheadline,
      button_color, email_cap, owner_email, notify_email,
      ls_customer_id, ls_subscription_id, upgraded_at, created_at
    `)
    .order('created_at', { ascending: false })
    .limit(2000);

  if (collErr) {
    console.error('Admin collectors error:', collErr);
    return res.status(500).json({ error: 'Failed to fetch collectors.' });
  }

  // Get email counts per collector in one query
  const { data: counts, error: countErr } = await supabase
    .from('emails')
    .select('collector_id')
    .in('collector_id', (collectors || []).map(c => c.id));

  // Build a count map
  const emailCounts = {};
  if (!countErr && counts) {
    for (const row of counts) {
      emailCounts[row.collector_id] = (emailCounts[row.collector_id] || 0) + 1;
    }
  }

  return res.status(200).json({
    collectors: collectors || [],
    emailCounts,
    generatedAt: new Date().toISOString(),
  });
};
