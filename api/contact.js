const { Resend } = require('resend');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { name, email, message, site } = req.body || {};

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Campi obbligatori mancanti' });
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY non configurata nelle variabili d\'ambiente Vercel');
    return res.status(500).json({ error: 'Servizio email non configurato' });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    await resend.emails.send({
      from: 'PLURIAGENCY Sito <hello@pluriagency.com>',
      to: 'hello@pluriagency.com',
      replyTo: email,
      subject: `Nuovo contatto da ${name} — ${site || 'pluriagency.com'}`,
      html: `
        <div style="font-family:sans-serif;max-width:580px;background:#0d0d12;color:#e8e8f0;padding:32px;border:1px solid rgba(255,255,255,0.1)">
          <div style="font-size:10px;letter-spacing:4px;color:#9b5cff;text-transform:uppercase;margin-bottom:20px">
            // NUOVO MESSAGGIO — ${(site||'pluriagency.com').toUpperCase()}
          </div>
          <table style="width:100%;border-collapse:collapse">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.07);font-size:11px;letter-spacing:2px;color:#6b6b80;text-transform:uppercase;width:100px">NOME</td>
              <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.07);font-size:15px">${escapeHtml(name)}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.07);font-size:11px;letter-spacing:2px;color:#6b6b80;text-transform:uppercase">EMAIL</td>
              <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.07);font-size:15px"><a href="mailto:${escapeHtml(email)}" style="color:#00ff88">${escapeHtml(email)}</a></td>
            </tr>
            <tr>
              <td style="padding:12px 0 0;font-size:11px;letter-spacing:2px;color:#6b6b80;text-transform:uppercase;vertical-align:top">MESSAGGIO</td>
              <td style="padding:12px 0 0;font-size:14px;line-height:1.7">${escapeHtml(message).replace(/\n/g,'<br>')}</td>
            </tr>
          </table>
        </div>
      `
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Resend error:', err);
    return res.status(500).json({ error: 'Errore invio email' });
  }
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
