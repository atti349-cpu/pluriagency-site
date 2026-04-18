const { Resend } = require('resend');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const {
    agentName, clientName, clientEmail,
    toAgency, toClient,
    lines, subtotal, discount, saved, ivaPct, ivaAmount, total, notes,
    pdfBase64, pdfFilename
  } = req.body || {};

  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY non configurata');
    return res.status(500).json({ error: 'Servizio email non configurato' });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const today = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });

  const plainText = buildQuotePlain({ agentName, clientName, clientEmail, lines, subtotal, discount, saved, ivaPct, ivaAmount, total, notes, today });
  const attachment = pdfBase64
    ? [{ filename: pdfFilename || 'Preventivo.pdf', content: Buffer.from(pdfBase64, 'base64') }]
    : undefined;

  const sends = [];
  const errors = [];

  // ── Internal email to hello@pluriagency.com ──────────────────────────────
  if (toAgency) {
    sends.push(
      resend.emails.send({
        from: 'PLURIAGENCY Preventivi <hello@pluriagency.com>',
        to: ['hello@pluriagency.com'],
        subject: `[Preventivo] ${clientName} — ${today}`,
        html: buildAgencyHTML({ agentName, clientName, clientEmail, lines, subtotal, discount, saved, ivaPct, ivaAmount, total, notes, today }),
        text: plainText,
        attachments: attachment
      }).then(r => { if (r.error) errors.push(r.error); return r; })
    );
  }

  // ── Client email ──────────────────────────────────────────────────────────
  if (toClient && clientEmail) {
    sends.push(
      resend.emails.send({
        from: 'PLURIAGENCY <hello@pluriagency.com>',
        to: [clientEmail],
        replyTo: 'hello@pluriagency.com',
        subject: `Il tuo preventivo Pluriagency — ${today}`,
        html: buildClientHTML({ agentName, clientName, lines, subtotal, discount, saved, ivaPct, ivaAmount, total, notes, today }),
        text: plainText,
        attachments: attachment
      }).then(r => { if (r.error) errors.push(r.error); return r; })
    );
  }

  if (!sends.length) {
    return res.status(400).json({ error: 'Nessun destinatario selezionato' });
  }

  await Promise.all(sends);

  if (errors.length) {
    console.error('Resend errors:', JSON.stringify(errors));
    return res.status(500).json({ error: errors[0]?.message || 'Errore invio email', details: errors });
  }

  return res.status(200).json({ ok: true });
};

// ──────────────────────────────────────────────────────────────────────────────
// INTERNAL email (hello@pluriagency.com) — includes client contact info
// ──────────────────────────────────────────────────────────────────────────────
function buildAgencyHTML({ agentName, clientName, clientEmail, lines, subtotal, discount, saved, ivaPct, ivaAmount, total, notes, today }) {
  const linesHtml = lines.map(l => {
    const i = l.indexOf(': ');
    const name = i > -1 ? l.slice(0, i) : l;
    const amt  = i > -1 ? l.slice(i + 2) : '';
    return `<tr>
      <td style="padding:9px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333">${esc(name)}</td>
      <td style="padding:9px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#111;text-align:right;font-weight:600;white-space:nowrap">${esc(amt)}</td>
    </tr>`;
  }).join('');

  const imponibile = subtotal - Math.round(saved || 0);
  const discountRow = discount > 0 ? `<tr>
    <td style="padding:7px 0;font-size:12px;color:#888">Sconto ${discount}%</td>
    <td style="padding:7px 0;font-size:13px;color:#2a7a4a;text-align:right;font-weight:600">-€${Math.round(saved).toLocaleString('it-IT')}</td>
  </tr>` : '';

  const ivaRow = ivaPct > 0 ? `<tr>
    <td style="padding:7px 0;font-size:12px;color:#888">Imponibile</td>
    <td style="padding:7px 0;font-size:13px;color:#333;text-align:right">€${imponibile.toLocaleString('it-IT')}</td>
  </tr><tr>
    <td style="padding:7px 0;font-size:12px;color:#1a6ebf">IVA ${ivaPct}%</td>
    <td style="padding:7px 0;font-size:13px;color:#1a6ebf;text-align:right;font-weight:600">+€${Math.round(ivaAmount||0).toLocaleString('it-IT')}</td>
  </tr>` : '';

  const totalLabel = ivaPct > 0 ? 'TOTALE IVA INCLUSA' : 'TOTALE STIMATO';
  const ivaNote = ivaPct > 0 ? 'Prezzi IVA inclusa (22%) · indicativi soggetti a conferma ufficiale' : 'IVA esclusa · prezzi indicativi';

  const notesHtml = notes ? `<div style="margin-top:20px;padding:14px 16px;background:#f9f9f9;border-left:3px solid #ddd">
    <div style="font-size:10px;letter-spacing:2px;color:#aaa;text-transform:uppercase;margin-bottom:6px">NOTE</div>
    <div style="font-size:13px;color:#555;line-height:1.6">${esc(notes).replace(/\n/g,'<br>')}</div>
  </div>` : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:28px 16px;background:#f4f4f4">
<tr><td>
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:4px;overflow:hidden;border:1px solid #e8e8e8">

  <tr><td style="background:#1c1c1c;padding:22px 28px">
    <span style="font-size:10px;letter-spacing:3px;color:#888;text-transform:uppercase">PLURIAGENCY — PREVENTIVO INTERNO</span><br>
    <span style="font-size:20px;font-weight:700;color:#fff;display:block;margin-top:6px">${esc(clientName)}</span>
    <span style="font-size:12px;color:#666">${today} · ${esc(agentName)}</span>
  </td></tr>

  <tr><td style="padding:20px 28px;background:#fffbea;border-bottom:1px solid #f0e68c">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="font-size:11px;color:#888;width:100px">Cliente</td>
        <td style="font-size:14px;color:#333;font-weight:600">${esc(clientName)}</td>
      </tr>
      <tr>
        <td style="font-size:11px;color:#888;padding-top:6px">Email</td>
        <td style="font-size:14px;padding-top:6px"><a href="mailto:${esc(clientEmail||'')}" style="color:#1a6ebf;text-decoration:none">${esc(clientEmail||'—')}</a></td>
      </tr>
      <tr>
        <td style="font-size:11px;color:#888;padding-top:6px">Agente</td>
        <td style="font-size:14px;color:#333;padding-top:6px">${esc(agentName)}</td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:24px 28px">
    <div style="font-size:10px;letter-spacing:2px;color:#aaa;text-transform:uppercase;margin-bottom:10px">SERVIZI</div>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${linesHtml}
      <tr><td colspan="2" style="padding:3px 0"></td></tr>
      ${discountRow}
      ${ivaRow}
      <tr><td colspan="2" style="padding:3px 0"></td></tr>
      <tr><td colspan="2">
        <div style="background:#1c1c1c;padding:12px 16px">
          <span style="font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:2px">${totalLabel}</span>
          <span style="font-size:18px;font-weight:700;color:#fff;float:right">€${total.toLocaleString('it-IT')}</span>
        </div>
      </td></tr>
    </table>
    <p style="font-size:11px;color:#bbb;margin:6px 0 0;font-style:italic">${ivaNote}</p>
    ${notesHtml}
  </td></tr>

  <tr><td style="background:#f9f9f9;padding:14px 28px;border-top:1px solid #eee">
    <p style="font-size:11px;color:#aaa;margin:0">PLURIAGENCY · hello@pluriagency.com · +39 389 688 1004 · Bologna</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ──────────────────────────────────────────────────────────────────────────────
// CLIENT email — friendly, mobile-first, minimal
// ──────────────────────────────────────────────────────────────────────────────
function buildClientHTML({ agentName, clientName, lines, subtotal, discount, saved, ivaPct, ivaAmount, total, notes, today }) {
  const linesHtml = lines.map(l => {
    const i = l.indexOf(': ');
    const name = i > -1 ? l.slice(0, i) : l;
    const amt  = i > -1 ? l.slice(i + 2) : '';
    return `<tr>
      <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333">${esc(name)}</td>
      <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#111;text-align:right;font-weight:600;white-space:nowrap">${esc(amt)}</td>
    </tr>`;
  }).join('');

  const imponibile = subtotal - Math.round(saved || 0);
  const discountRow = discount > 0 ? `<tr>
    <td style="padding:7px 0;font-size:13px;color:#888">Sconto ${discount}%</td>
    <td style="padding:7px 0;font-size:13px;color:#2a7a4a;text-align:right;font-weight:600">-€${Math.round(saved).toLocaleString('it-IT')}</td>
  </tr>` : '';

  const ivaRow = ivaPct > 0 ? `<tr>
    <td style="padding:7px 0;font-size:12px;color:#888">Imponibile</td>
    <td style="padding:7px 0;font-size:13px;color:#333;text-align:right">€${imponibile.toLocaleString('it-IT')}</td>
  </tr><tr>
    <td style="padding:7px 0;font-size:12px;color:#1a6ebf">IVA ${ivaPct}%</td>
    <td style="padding:7px 0;font-size:13px;color:#1a6ebf;text-align:right;font-weight:600">+€${Math.round(ivaAmount||0).toLocaleString('it-IT')}</td>
  </tr>` : '';

  const totalLabel = ivaPct > 0 ? 'TOTALE IVA INCLUSA' : 'TOTALE STIMATO';
  const ivaNote = ivaPct > 0 ? 'Prezzi IVA inclusa (22%) · indicativi soggetti a conferma ufficiale' : 'IVA esclusa · prezzi indicativi soggetti a conferma ufficiale';

  const notesHtml = notes ? `<div style="margin-top:20px;padding:14px 16px;background:#f9f9f9;border-left:3px solid #ddd">
    <div style="font-size:10px;letter-spacing:2px;color:#aaa;text-transform:uppercase;margin-bottom:6px">NOTE</div>
    <div style="font-size:13px;color:#555;line-height:1.6">${esc(notes).replace(/\n/g,'<br>')}</div>
  </div>` : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:28px 16px;background:#f4f4f4">
<tr><td>
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:4px;overflow:hidden;border:1px solid #e8e8e8">

  <tr><td style="background:#1c1c1c;padding:22px 28px">
    <span style="font-size:10px;letter-spacing:3px;color:#888;text-transform:uppercase">PLURIAGENCY</span><br>
    <span style="font-size:20px;font-weight:700;color:#fff;display:block;margin-top:6px">Preventivo per ${esc(clientName)}</span>
    <span style="font-size:12px;color:#666">${today}</span>
  </td></tr>

  <tr><td style="padding:24px 28px">
    <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 6px">Ciao ${esc(clientName)},</p>
    <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 24px">
      in allegato trovi il preventivo in PDF con tutti i dettagli.
      Qui sotto un riepilogo rapido — per domande o modifiche, rispondimi direttamente a questa email.
    </p>

    <div style="font-size:10px;letter-spacing:2px;color:#aaa;text-transform:uppercase;margin-bottom:10px">RIEPILOGO SERVIZI</div>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${linesHtml}
      <tr><td colspan="2" style="padding:3px 0"></td></tr>
      ${discountRow}
      ${ivaRow}
      <tr><td colspan="2" style="padding:3px 0"></td></tr>
      <tr><td colspan="2">
        <div style="background:#1c1c1c;padding:12px 16px">
          <span style="font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:2px">${totalLabel}</span>
          <span style="font-size:18px;font-weight:700;color:#fff;float:right">€${total.toLocaleString('it-IT')}</span>
        </div>
      </td></tr>
    </table>
    <p style="font-size:11px;color:#bbb;margin:6px 0 0;font-style:italic">${ivaNote}</p>
    ${notesHtml}
  </td></tr>

  <tr><td style="padding:20px 28px;border-top:1px solid #eee">
    <p style="font-size:13px;color:#555;margin:0 0 4px">Con piacere,</p>
    <p style="font-size:13px;font-weight:600;color:#333;margin:0">${esc(agentName)} — Pluriagency</p>
    <p style="font-size:12px;color:#aaa;margin:4px 0 0">hello@pluriagency.com · +39 389 688 1004</p>
  </td></tr>

  <tr><td style="background:#f9f9f9;padding:12px 28px;border-top:1px solid #eee">
    <p style="font-size:11px;color:#ccc;margin:0">PLURIAGENCY · Bologna, Italia · pluriagency.com</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ──────────────────────────────────────────────────────────────────────────────
// PLAIN TEXT fallback
// ──────────────────────────────────────────────────────────────────────────────
function buildQuotePlain({ agentName, clientName, clientEmail, lines, subtotal, discount, saved, ivaPct, ivaAmount, total, notes, today }) {
  const sep = '─'.repeat(44);
  const linesText = lines.map(l => `  • ${l}`).join('\n');
  const imponibile = subtotal - Math.round(saved || 0);
  const discountLine = discount > 0 ? `  Sconto ${discount}%: -EUR ${Math.round(saved).toLocaleString('it-IT')}\n` : '';
  const ivaLine = ivaPct > 0 ? `  Imponibile: EUR ${imponibile.toLocaleString('it-IT')}\n  IVA ${ivaPct}%: +EUR ${Math.round(ivaAmount||0).toLocaleString('it-IT')}\n` : '';
  const totalLabel = ivaPct > 0 ? 'TOTALE IVA INCLUSA' : 'TOTALE STIMATO';
  const ivaNota = ivaPct > 0 ? 'Prezzi IVA inclusa (22%)' : 'IVA esclusa';
  const notesText = notes ? `\nNOTE\n${sep}\n${notes}\n` : '';
  const emailLine = clientEmail ? `Email cliente: ${clientEmail}\n` : '';
  return `PLURIAGENCY — PREVENTIVO SERVIZI
${sep}
Cliente: ${clientName}
${emailLine}Data: ${today}
Preparato da: ${agentName}

SERVIZI SELEZIONATI
${sep}
${linesText}

${sep}
Subtotale: EUR ${subtotal.toLocaleString('it-IT')}
${discountLine}${ivaLine}${totalLabel}: EUR ${total.toLocaleString('it-IT')}
${ivaNota} · prezzi indicativi soggetti a conferma
${notesText}
${sep}
PLURIAGENCY · hello@pluriagency.com · +39 389 688 1004 · Bologna, Italia`;
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
