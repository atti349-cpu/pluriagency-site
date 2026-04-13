const { Resend } = require('resend');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { name, email, message, site, area, services } = req.body || {};

  if (!name || !email) {
    return res.status(400).json({ error: 'Campi obbligatori mancanti' });
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY non configurata nelle variabili d\'ambiente Vercel');
    return res.status(500).json({ error: 'Servizio email non configurato' });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const { data, error } = await resend.emails.send({
      from: 'PLURIAGENCY <hello@pluriagency.com>',
      to: 'hello@pluriagency.com',
      replyTo: email,
      subject: `Nuovo contatto da ${name} — ${site || 'pluriagency.com'}`,
      html: buildContactHTML({ name, email, message, site, area, services })
    });

  if (error) {
    console.error('Resend error:', JSON.stringify(error));
    return res.status(500).json({ error: error.message || 'Errore invio email', detail: error });
  }

  console.log('Resend OK, id:', data?.id);
  return res.status(200).json({ ok: true, id: data?.id });
};

function buildContactHTML({ name, email, message, site, area, services }) {
  const areaRow = area ? `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.07);font-size:11px;letter-spacing:2px;color:#6b6b80;text-transform:uppercase;width:110px;vertical-align:top">AREA</td>
      <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.07)">
        <span style="font-size:13px;font-weight:700;letter-spacing:2px;color:#00ff88;background:rgba(0,255,136,0.08);padding:4px 12px;border:1px solid rgba(0,255,136,0.3)">${escapeHtml(area)}</span>
      </td>
    </tr>` : '';

  const svcList = Array.isArray(services) && services.length
    ? services.map(s=>`<span style="display:inline-block;font-size:11px;letter-spacing:1.5px;color:#9b5cff;background:rgba(155,92,255,0.08);border:1px solid rgba(155,92,255,0.3);padding:4px 10px;margin:3px 4px 3px 0">${escapeHtml(s)}</span>`).join('')
    : '<span style="color:#6b6b80;font-size:12px">—</span>';

  const servicesRow = area ? `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.07);font-size:11px;letter-spacing:2px;color:#6b6b80;text-transform:uppercase;vertical-align:top">SERVIZI</td>
      <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.07)">${svcList}</td>
    </tr>` : '';

  const msgRow = message ? `
    <tr>
      <td style="padding:12px 0 0;font-size:11px;letter-spacing:2px;color:#6b6b80;text-transform:uppercase;vertical-align:top">MESSAGGIO</td>
      <td style="padding:12px 0 0;font-size:14px;line-height:1.7;color:#e8e8f0">${escapeHtml(message).replace(/\n/g,'<br>')}</td>
    </tr>` : '';

  return `
    <div style="font-family:sans-serif;max-width:580px;background:#0d0d12;color:#e8e8f0;padding:32px;border:1px solid rgba(255,255,255,0.1)">
      <div style="font-size:10px;letter-spacing:4px;color:#9b5cff;text-transform:uppercase;margin-bottom:20px">
        // NUOVO CONTATTO — ${escapeHtml((site||'pluriagency.com').toUpperCase())}
      </div>
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.07);font-size:11px;letter-spacing:2px;color:#6b6b80;text-transform:uppercase;width:110px">NOME</td>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.07);font-size:15px">${escapeHtml(name)}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.07);font-size:11px;letter-spacing:2px;color:#6b6b80;text-transform:uppercase">EMAIL</td>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.07);font-size:15px"><a href="mailto:${escapeHtml(email)}" style="color:#00ff88">${escapeHtml(email)}</a></td>
        </tr>
        ${areaRow}
        ${servicesRow}
        ${msgRow}
      </table>
    </div>`;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
