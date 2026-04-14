import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl     = process.env.SUPABASE_URL;
  const supabaseService = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseService) {
    return res.status(500).json({ error: 'Supabase config mancante' });
  }

  const sb = createClient(supabaseUrl, supabaseService, {
    auth: { persistSession: false }
  });

  const {
    agent_name, agent_email,
    client_name, client_email,
    items, subtotal, discount_pct, discount_amount, total,
    notes, status = 'bozza',
    quote_id // se presente → aggiornamento
  } = req.body;

  if (!agent_name || !client_name) {
    return res.status(400).json({ error: 'agent_name e client_name sono obbligatori' });
  }

  try {
    // 1. Risolvi agent_id dalla tabella agenti (by name)
    let agentId = null;
    if (agent_name) {
      const { data: agentRow } = await sb
        .from('agenti')
        .select('id, email')
        .eq('name', agent_name)
        .maybeSingle();
      if (agentRow) agentId = agentRow.id;
    }

    // 2. Upsert cliente (by email, se presente)
    let clientId = null;
    if (client_email) {
      const { data: existingClient } = await sb
        .from('clienti')
        .select('id')
        .eq('email', client_email)
        .maybeSingle();

      if (existingClient) {
        clientId = existingClient.id;
      } else {
        const { data: newClient, error: clientErr } = await sb
          .from('clienti')
          .insert({ name: client_name, email: client_email, agent_id: agentId })
          .select('id')
          .single();
        if (clientErr) throw clientErr;
        clientId = newClient.id;
      }
    }

    // 3. Salva o aggiorna preventivo
    const payload = {
      agent_name,
      agent_email:     agent_email || null,
      agent_id:        agentId,
      client_name,
      client_email:    client_email || null,
      client_id:       clientId,
      items:           items || [],
      subtotal:        subtotal || 0,
      discount_pct:    discount_pct || 0,
      discount_amount: discount_amount || 0,
      total:           total || 0,
      notes:           notes || null,
      status,
      updated_at:      new Date().toISOString()
    };

    let savedId;
    if (quote_id) {
      // Aggiornamento — non cambia lo status se già venduto
      const { data: existing } = await sb
        .from('preventivi')
        .select('status')
        .eq('id', quote_id)
        .single();
      if (existing?.status === 'venduto') {
        return res.status(400).json({ error: 'Preventivo venduto: non modificabile' });
      }
      const { data, error } = await sb
        .from('preventivi')
        .update(payload)
        .eq('id', quote_id)
        .select('id')
        .single();
      if (error) throw error;
      savedId = data.id;
    } else {
      const { data, error } = await sb
        .from('preventivi')
        .insert(payload)
        .select('id')
        .single();
      if (error) throw error;
      savedId = data.id;
    }

    return res.status(200).json({ success: true, id: savedId });

  } catch (err) {
    console.error('[save-quote]', err);
    return res.status(500).json({ error: err.message || 'Errore interno' });
  }
}
