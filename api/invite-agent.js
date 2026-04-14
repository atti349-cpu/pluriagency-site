export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, name } = req.body;
  if (!email) return res.status(400).json({ error: 'Email obbligatoria' });

  const supabaseUrl     = process.env.SUPABASE_URL;
  const supabaseService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseService) {
    return res.status(500).json({ error: 'Config Supabase mancante' });
  }

  // Supabase Admin API — invita utente (riceve magic link via email)
  const r = await fetch(`${supabaseUrl}/auth/v1/invite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseService,
      'Authorization': `Bearer ${supabaseService}`
    },
    body: JSON.stringify({
      email,
      data: { name, role: 'agent' },
      redirect_to: 'https://pluriagency.com/admin'
    })
  });

  const json = await r.json();
  if (!r.ok) {
    return res.status(400).json({ error: json.msg || json.error || 'Invito fallito' });
  }

  return res.status(200).json({ success: true });
}
