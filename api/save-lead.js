import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const supabaseUrl     = process.env.SUPABASE_URL;
  const supabaseService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseService) return res.status(500).json({ error: 'Config mancante' });

  const sb = createClient(supabaseUrl, supabaseService, { auth: { persistSession: false } });

  const { nome, email, messaggio, area, servizi, fonte = 'homepage' } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email obbligatoria' });

  const { data, error } = await sb.from('leads').insert({
    nome:         nome || null,
    email,
    messaggio:    messaggio || null,
    area:         area || null,
    servizi:      servizi || [],
    fonte,
    stato:        'nuovo',
    gestori:      [],
    note_azioni:  null,
  }).select('id').single();

  if (error) {
    console.error('[save-lead]', error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true, id: data.id });
}
