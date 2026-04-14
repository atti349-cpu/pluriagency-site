// api/config.js
// Restituisce le variabili pubbliche Supabase all'admin dashboard (client-side)
// Le anon key sono safe da esporre — protette da RLS su Supabase

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl     = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'Supabase config missing — aggiungere SUPABASE_URL e SUPABASE_ANON_KEY nelle env vars Vercel' });
  }

  res.setHeader('Cache-Control', 'no-store');
  res.json({ supabaseUrl, supabaseAnonKey });
}
