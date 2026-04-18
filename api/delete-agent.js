export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email obbligatoria' });

  const supabaseUrl     = process.env.SUPABASE_URL;
  const supabaseService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseService) {
    return res.status(500).json({ error: 'Config Supabase mancante' });
  }

  // Find auth user by email (iterate admin list — small user base)
  let authUserId = null;
  let page = 1;
  while (!authUserId) {
    const r = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=100&page=${page}`, {
      headers: { 'apikey': supabaseService, 'Authorization': `Bearer ${supabaseService}` }
    });
    if (!r.ok) break;
    const { users, total } = await r.json();
    if (!users || !users.length) break;
    const found = users.find(u => u.email === email);
    if (found) { authUserId = found.id; break; }
    if (users.length < 100) break; // no more pages
    page++;
  }

  if (!authUserId) {
    // User not in auth.users — nothing to delete there, not an error
    return res.status(200).json({ success: true, note: 'auth user not found' });
  }

  const r2 = await fetch(`${supabaseUrl}/auth/v1/admin/users/${authUserId}`, {
    method: 'DELETE',
    headers: { 'apikey': supabaseService, 'Authorization': `Bearer ${supabaseService}` }
  });

  if (!r2.ok) {
    const json = await r2.json().catch(() => ({}));
    return res.status(400).json({ error: json.msg || json.error || 'Eliminazione auth fallita' });
  }

  return res.status(200).json({ success: true });
}
