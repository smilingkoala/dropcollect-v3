// api/admin/export.js — GET /api/admin/export
// Returns every email across every collector joined with collector metadata
// Protected by ADMIN_SECRET — you own all this data

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

  // Fetch all emails joined with collector info
  const { data: rows, error } = await supabase
    .from('emails')
    .select(`
      collector_id,
      email,
      collected_at,
      collectors (
        tier,
        owner_email,
        headline
      )
    `)
    .order('collected_at', { ascending: false })
    .limit(100000);

  if (error) {
    console.error('Admin export error:', error);
    return res.status(500).json({ error: 'Failed to export data.' });
  }

  // Flatten for response
  const flat = (rows || []).map(r => ({
    collector_id: r.collector_id,
    owner_email: r.collectors?.owner_email || '',
    tier: r.collectors?.tier || '',
    headline: r.collectors?.headline || '',
    email: r.email,
    collected_at: r.collected_at,
  }));

  return res.status(200).json({
    rows: flat,
    total: flat.length,
    exportedAt: new Date().toISOString(),
  });
};
