const { Resend } = require('resend');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { slug, nome, email, messaggio, categorie = [] } = req.body || {};
  if (!nome || !email || !slug) {
    return res.status(400).json({ error: 'Dati obbligatori mancanti' });
  }

  const supabaseUrl     = process.env.SUPABASE_URL;
  const supabaseService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey       = process.env.RESEND_API_KEY;
  if (!supabaseUrl || !supabaseService || !resendKey) {
    return res.status(500).json({ error: 'Config server mancante' });
  }

  const sb = createClient(supabaseUrl, supabaseService);

  // 1. Get team card + agent email
  let agentName = slug;
  let agentEmail = null;
  try {
    const { data: card } = await sb
      .from('team_cards')
      .select('nome, agente_id')
      .eq('slug', slug)
      .eq('attiva', true)
      .maybeSingle();

    if (card) {
      agentName = card.nome || slug;
      if (card.agente_id) {
        const { data: agente } = await sb
          .from('agenti')
          .select('email')
          .eq('id', card.agente_id)
          .maybeSingle();
        agentEmail = agente?.email || null;
      }
    }
  } catch (e) {
    // non-blocking — still send to hello@
  }

  // 2. Build recipient list
  const toList = ['hello@pluriagency.com'];
  if (agentEmail && agentEmail !== 'hello@pluriagency.com') {
    toList.push(agentEmail);
  }

  // 3. Send email
  const resend = new Resend(resendKey);
  const { error } = await resend.emails.send({
    from: 'PLURIAGENCY <hello@pluriagency.com>',
    to: toList,
    replyTo: email,
    subject: `[${agentName.toUpperCase()}] Nuovo contatto da ${nome} — pluriagency.com`,
    html: buildHTML({ nome, email, messaggio, categorie, agentName }),
  });

  if (error) {
    console.error('Resend error:', JSON.stringify(error));
    return res.status(500).json({ error: error.message || 'Errore invio email' });
  }

  return res.status(200).json({ ok: true });
};

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildHTML({ nome, email, messaggio, categorie, agentName }) {
  const chips = categorie.length
    ? categorie.map(c => `<span style="display:inline-block;font-size:11px;letter-spacing:2px;color:#00ff88;background:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.3);padding:5px 14px;margin:3px 5px 3px 0;text-transform:uppercase">${esc(c)}</span>`).join('')
    : '<span style="color:#6b6b80;font-size:12px">—</span>';

  const msgRow = messaggio ? `
    <tr>
      <td style="padding:12px 0 0;font-size:11px;letter-spacing:2px;color:#6b6b80;text-transform:uppercase;vertical-align:top">MESSAGGIO</td>
      <td style="padding:12px 0 0;font-size:14px;line-height:1.7;color:#e8e8f0">${esc(messaggio).replace(/\n/g,'<br>')}</td>
    </tr>` : '';

  return `
    <div style="font-family:sans-serif;max-width:580px;background:#0d0d12;color:#e8e8f0;padding:32px;border:1px solid rgba(255,255,255,0.1)">
      <div style="font-size:10px;letter-spacing:4px;color:#9b5cff;text-transform:uppercase;margin-bottom:6px">
        // NUOVO CONTATTO — PLURIAGENCY
      </div>
      <div style="font-size:14px;letter-spacing:2px;color:#00ff88;margin-bottom:24px;font-weight:700">
        DA PAGINA: ${esc(agentName.toUpperCase())}
      </div>
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.07);font-size:11px;letter-spacing:2px;color:#6b6b80;text-transform:uppercase;width:120px">NOME</td>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.07);font-size:15px">${esc(nome)}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.07);font-size:11px;letter-spacing:2px;color:#6b6b80;text-transform:uppercase">EMAIL</td>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.07);font-size:15px"><a href="mailto:${esc(email)}" style="color:#00ff88">${esc(email)}</a></td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.07);font-size:11px;letter-spacing:2px;color:#6b6b80;text-transform:uppercase;vertical-align:top">INTERESSE</td>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.07)">${chips}</td>
        </tr>
        ${msgRow}
      </table>
    </div>`;
}
