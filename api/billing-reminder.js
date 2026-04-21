const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

// Protezione: solo chiamate con il secret corretto
const CRON_SECRET = process.env.CRON_SECRET || '';

module.exports = async (req, res) => {
  // Verifica secret header (chiamata da cron-job.org)
  if(CRON_SECRET && req.headers['x-cron-secret'] !== CRON_SECRET){
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const resend = new Resend(process.env.RESEND_API_KEY);

  // Calcola fine mese e soglia 7 giorni
  const oggi = new Date();
  const fineMese = new Date(oggi.getFullYear(), oggi.getMonth() + 1, 0); // ultimo giorno del mese
  const sogliaGiorni = new Date(fineMese);
  sogliaGiorni.setDate(sogliaGiorni.getDate() - 7);

  // Controlla se siamo nell'ultimo lunedì prima della fine del mese (o ≤7gg dalla fine)
  const giorniAllaFine = Math.ceil((fineMese - oggi) / (1000 * 60 * 60 * 24));
  if(giorniAllaFine > 7){
    return res.status(200).json({ skipped: true, message: 'Non ancora entro i 7 giorni dalla fine del mese' });
  }

  // Carica tutti i canoni attivi con scadenza entro fine mese
  const { data: canoni, error } = await sb.from('canoni')
    .select('*')
    .eq('stato', 'attivo')
    .lte('data_prossimo_pagamento', fineMese.toISOString().slice(0, 10))
    .order('data_prossimo_pagamento');

  if(error) return res.status(500).json({ error: error.message });
  if(!canoni || !canoni.length) return res.status(200).json({ sent: 0, message: 'Nessun canone in scadenza' });

  // Raggruppa per agente
  const perAgente = {};
  canoni.forEach(c => {
    const key = c.agente_email || 'nessun_agente';
    if(!perAgente[key]) perAgente[key] = [];
    perAgente[key].push(c);
  });

  const formatEur = n => `€ ${Number(n).toLocaleString('it-IT')}`;
  const formatDate = d => d ? new Date(d).toLocaleDateString('it-IT') : '—';

  function buildTable(list){
    return `<table style="width:100%;border-collapse:collapse;font-family:monospace;font-size:13px">
      <tr style="background:#1a1a2e;color:#9b5cff">
        <th style="padding:8px;text-align:left;border:1px solid #333">Cliente</th>
        <th style="padding:8px;text-align:left;border:1px solid #333">Servizio</th>
        <th style="padding:8px;text-align:right;border:1px solid #333">Importo</th>
        <th style="padding:8px;text-align:center;border:1px solid #333">Freq.</th>
        <th style="padding:8px;text-align:center;border:1px solid #333">Scadenza</th>
      </tr>
      ${list.map(c=>`<tr style="background:#0d0d14;color:#e8e8f0">
        <td style="padding:7px 8px;border:1px solid #222">${c.client_name}</td>
        <td style="padding:7px 8px;border:1px solid #222">${c.item_name}</td>
        <td style="padding:7px 8px;text-align:right;border:1px solid #222;color:#9b5cff;font-weight:bold">${formatEur(c.amount)}</td>
        <td style="padding:7px 8px;text-align:center;border:1px solid #222">${c.frequency==='monthly'?'Mensile':'Annuale'}</td>
        <td style="padding:7px 8px;text-align:center;border:1px solid #222;color:#ffc800">${formatDate(c.data_prossimo_pagamento)}</td>
      </tr>`).join('')}
    </table>`;
  }

  let sent = 0;

  // Email per ogni agente con i suoi canoni
  for(const [agente, lista] of Object.entries(perAgente)){
    if(agente === 'nessun_agente') continue;
    const totale = lista.reduce((s,c)=>s+Number(c.amount),0);
    await resend.emails.send({
      from: 'PLURIAGENCY <hello@pluriagency.com>',
      to: agente,
      subject: `◈ Promemoria pagamenti — ${lista.length} canoni in scadenza`,
      html: `<div style="background:#06060a;padding:32px;font-family:monospace">
        <div style="color:#00ff88;font-size:11px;letter-spacing:4px;margin-bottom:8px">PLURIAGENCY</div>
        <div style="color:#e8e8f0;font-size:20px;font-weight:bold;margin-bottom:4px">◈ PROMEMORIA PAGAMENTI</div>
        <div style="color:#6b6b80;font-size:12px;margin-bottom:24px">Canoni in scadenza entro fine mese</div>
        ${buildTable(lista)}
        <div style="margin-top:20px;padding:16px;background:#111119;border-left:3px solid #9b5cff">
          <span style="color:#9b5cff;font-weight:bold">TOTALE IN SCADENZA: ${formatEur(totale)}</span>
        </div>
        <div style="margin-top:24px;color:#6b6b80;font-size:11px">
          Gestisci i canoni su <a href="https://pluriagency.com/admin" style="color:#9b5cff">pluriagency.com/admin → FATTURAZIONE</a>
        </div>
      </div>`
    });
    sent++;
  }

  // Email riepilogo completo ad admin
  const adminEmail = 'atti349@gmail.com';
  const totaleGlobale = canoni.reduce((s,c)=>s+Number(c.amount),0);
  await resend.emails.send({
    from: 'PLURIAGENCY <hello@pluriagency.com>',
    to: adminEmail,
    subject: `◈ Riepilogo fatturazione — ${canoni.length} canoni in scadenza (${formatEur(totaleGlobale)})`,
    html: `<div style="background:#06060a;padding:32px;font-family:monospace">
      <div style="color:#00ff88;font-size:11px;letter-spacing:4px;margin-bottom:8px">PLURIAGENCY ADMIN</div>
      <div style="color:#e8e8f0;font-size:20px;font-weight:bold;margin-bottom:4px">◈ RIEPILOGO FATTURAZIONE</div>
      <div style="color:#6b6b80;font-size:12px;margin-bottom:24px">Tutti i canoni in scadenza entro fine mese — ${new Date().toLocaleDateString('it-IT')}</div>
      ${buildTable(canoni)}
      <div style="margin-top:20px;padding:16px;background:#111119;border-left:3px solid #00ff88">
        <span style="color:#00ff88;font-weight:bold">TOTALE GLOBALE IN SCADENZA: ${formatEur(totaleGlobale)}</span>
        &nbsp;&nbsp;<span style="color:#6b6b80;font-size:11px">${canoni.length} canoni · ${Object.keys(perAgente).length} agenti coinvolti</span>
      </div>
      <div style="margin-top:24px;color:#6b6b80;font-size:11px">
        <a href="https://pluriagency.com/admin" style="color:#9b5cff">Apri Admin → FATTURAZIONE</a>
      </div>
    </div>`
  });

  return res.status(200).json({ sent: sent + 1, canoni: canoni.length, totale: totaleGlobale });
};
