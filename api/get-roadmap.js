const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data, error } = await sb.from('roadmap_data').select('data').eq('id', id).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });

  res.status(200).json({ data: data?.data || null });
};
