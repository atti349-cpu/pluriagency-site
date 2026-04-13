const { Resend } = require('resend');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const {
    agentName, clientName, email,
    toAgency, toClient,
    lines, subtotal, discount, saved, total, notes
  } = req.body || {};

  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY non configurata');
    return res.status(500).json({ error: 'Servizio email non configurato' });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const today = new Date().toLocaleDateString('it-IT', { day:'2-digit', month:'long', year:'numeric' });

  const htmlBody = buildQuoteHTML({ agentName, clientName, lines, subtotal, discount, saved, total, notes, today });

  const recipients = [];
  if (toAgency) recipients.push('hello@pluriagency.com');
  if (toClient && email) recipients.push(email);

  if (!recipients.length) {
    return res.status(400).json({ error: 'Nessun destinatario selezionato' });
  }

  const plainText = buildQuotePlain({ agentName, clientName, lines, subtotal, discount, saved, total, notes, today });

  const { data, error } = await resend.emails.send({
    from: 'PLURIAGENCY Preventivi <hello@pluriagency.com>',
    to: recipients,
    subject: `Preventivo per ${clientName} — ${today}`,
    html: htmlBody,
    text: plainText
  });

  if (error) {
    console.error('Resend error:', JSON.stringify(error));
    return res.status(500).json({ error: error.message || 'Errore invio email', detail: error });
  }

  console.log('Resend OK, id:', data?.id);
  return res.status(200).json({ ok: true, id: data?.id });
};

function buildQuoteHTML({ agentName, clientName, lines, subtotal, discount, saved, total, notes, today }) {
  const linesHtml = lines.map(l => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid rgba(155,92,255,0.1);font-size:14px;color:#e8e8f0">${escapeHtml(l.split(':')[0])}</td>
      <td style="padding:8px 0;border-bottom:1px solid rgba(155,92,255,0.1);font-size:14px;color:#c89bff;text-align:right;white-space:nowrap">${escapeHtml(l.split(':').slice(1).join(':').trim())}</td>
    </tr>`).join('');

  const discountRow = discount > 0 ? `
    <tr>
      <td style="padding:8px 0;font-size:12px;color:#6b6b80;letter-spacing:1px">SCONTO ${discount}%</td>
      <td style="padding:8px 0;font-size:14px;color:#00ff88;text-align:right">−€${Math.round(saved).toLocaleString('it-IT')}</td>
    </tr>` : '';

  const notesSection = notes ? `
    <div style="margin-top:28px;padding:16px;background:rgba(155,92,255,0.06);border:1px solid rgba(155,92,255,0.15)">
      <div style="font-size:10px;letter-spacing:3px;color:#9b5cff;text-transform:uppercase;margin-bottom:8px">NOTE</div>
      <div style="font-size:13px;color:#8888a0;line-height:1.7">${escapeHtml(notes).replace(/\n/g,'<br>')}</div>
    </div>` : '';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#06060a;font-family:sans-serif">
  <div style="max-width:600px;margin:0 auto;background:#0d0d12;color:#e8e8f0">

    <!-- HEADER -->
    <div style="padding:32px 36px 24px;border-bottom:1px solid rgba(155,92,255,0.2);
      background:linear-gradient(135deg,rgba(155,92,255,0.08),transparent)">
      <div style="font-size:9px;letter-spacing:5px;color:#9b5cff;text-transform:uppercase;margin-bottom:12px">
        PLURIAGENCY — PREVENTIVO SERVIZI
      </div>
      <div style="font-size:26px;font-weight:900;letter-spacing:2px;color:#e8e8f0;margin-bottom:4px">
        ${escapeHtml(clientName)}
      </div>
      <div style="font-size:12px;color:#6b6b80;letter-spacing:1px">${today} · preparato da ${escapeHtml(agentName)}</div>
    </div>

    <!-- SERVICES TABLE -->
    <div style="padding:28px 36px">
      <div style="font-size:9px;letter-spacing:4px;color:#6b6b80;text-transform:uppercase;margin-bottom:16px">
        SERVIZI SELEZIONATI
      </div>
      <table style="width:100%;border-collapse:collapse">
        ${linesHtml}
        <tr><td colspan="2" style="padding:6px 0"></td></tr>
        <tr>
          <td style="padding:8px 0;border-top:1px solid rgba(155,92,255,0.2);font-size:12px;color:#6b6b80;letter-spacing:1px">SUBTOTALE</td>
          <td style="padding:8px 0;border-top:1px solid rgba(155,92,255,0.2);font-size:14px;color:#e8e8f0;text-align:right">€${subtotal.toLocaleString('it-IT')}</td>
        </tr>
        ${discountRow}
        <tr>
          <td style="padding:14px 0 0;font-size:11px;letter-spacing:3px;color:#9b5cff;text-transform:uppercase">TOTALE STIMATO</td>
          <td style="padding:14px 0 0;font-size:22px;font-weight:900;color:#c89bff;text-align:right">€${total.toLocaleString('it-IT')}</td>
        </tr>
      </table>
      <div style="font-size:11px;color:#6b6b80;margin-top:8px;font-style:italic">
        IVA esclusa · prezzi indicativi soggetti a conferma
      </div>

      ${notesSection}
    </div>

    <!-- FOOTER -->
    <div style="padding:20px 36px;border-top:1px solid rgba(255,255,255,0.06);
      font-size:11px;color:#6b6b80;letter-spacing:1px;line-height:1.7">
      PLURIAGENCY · hello@pluriagency.com · +39 389 688 1004 · Bologna, Italia
    </div>

  </div>
</body>
</html>`;
}

function buildQuotePlain({ agentName, clientName, lines, subtotal, discount, saved, total, notes, today }) {
  const sep = '─'.repeat(44);
  const linesText = lines.map(l => `  • ${l}`).join('\n');
  const discountLine = discount > 0 ? `  Sconto ${discount}%: -€${Math.round(saved).toLocaleString('it-IT')}\n` : '';
  const notesText = notes ? `\nNOTE\n${sep}\n${notes}\n` : '';
  return `PLURIAGENCY — PREVENTIVO SERVIZI
${sep}
Cliente: ${clientName}
Data: ${today}
Preparato da: ${agentName}

SERVIZI SELEZIONATI
${sep}
${linesText}

${sep}
Subtotale: €${subtotal.toLocaleString('it-IT')}
${discountLine}TOTALE STIMATO: €${total.toLocaleString('it-IT')}
IVA esclusa · prezzi indicativi soggetti a conferma
${notesText}
${sep}
PLURIAGENCY · hello@pluriagency.com · +39 389 688 1004 · Bologna, Italia`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
