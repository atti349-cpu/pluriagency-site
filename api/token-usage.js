// api/token-usage.js
// Proxy per Anthropic Usage API — super-admin only
//
// Env var richiesta:
//   TOKEN_ACCOUNTS_JSON — array JSON di oggetti account, es:
//   [
//     {
//       "id": "acc_001",
//       "name": "Chatbot Ecommerce",
//       "apiKey": "sk-ant-api03-...",
//       "monthlyLimit": 1000000,
//       "renewalDate": "15 di ogni mese"
//     }
//   ]
//
// NOTA: NON aggiungere TOKEN_ACCOUNTS_JSON a .env per lo sviluppo locale se contiene
//       API key reali. Usare esclusivamente le env vars di Vercel (crittografate).

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'no-store');

  // Leggi e valida la configurazione account
  let accounts;
  try {
    const raw = process.env.TOKEN_ACCOUNTS_JSON;
    if (!raw) return res.status(200).json({ accounts: [] });
    accounts = JSON.parse(raw);
    if (!Array.isArray(accounts)) throw new Error('TOKEN_ACCOUNTS_JSON deve essere un array');
  } catch (e) {
    return res.status(500).json({ error: `Configurazione non valida: ${e.message}` });
  }

  const { action, id, start, end } = req.query;

  // ── Azione: lista account (senza esporre le apiKey al client) ──
  if (action === 'accounts') {
    return res.json({
      accounts: accounts.map(a => ({
        id: a.id,
        name: a.name,
        monthlyLimit: a.monthlyLimit || 1000000,
        renewalDate: a.renewalDate || '—',
      })),
    });
  }

  // ── Azione: fetch usage per un account specifico ──
  if (!id) return res.status(400).json({ error: 'Parametro id mancante' });

  const acc = accounts.find(a => a.id === id);
  if (!acc) return res.status(404).json({ error: `Account "${id}" non trovato in TOKEN_ACCOUNTS_JSON` });
  if (!acc.apiKey) return res.status(500).json({ error: `apiKey mancante per account "${id}"` });

  // Range date: default = mese corrente
  const today = new Date();
  const startDate = start || new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const endDate   = end   || today.toISOString().split('T')[0];

  try {
    const r = await fetch(
      `https://api.anthropic.com/v1/usage?start_date=${startDate}&end_date=${endDate}`,
      {
        headers: {
          'x-api-key': acc.apiKey,
          'anthropic-version': '2023-06-01',
        },
      }
    );

    if (!r.ok) {
      // Restituiamo used:0 con il messaggio di errore invece di bloccare il render
      const errText = await r.text().catch(() => '');
      return res.status(200).json({
        used: 0,
        error: `API Anthropic ${r.status}: ${errText.substring(0, 120)}`,
      });
    }

    const data = await r.json();

    // La risposta Anthropic Usage API può avere formati diversi:
    // - { data: [ { input_tokens, output_tokens, ... }, ... ] }  (array per giorno/modello)
    // - { input_tokens, output_tokens }                           (totale diretto)
    let totalTokens = 0;
    if (Array.isArray(data.data)) {
      totalTokens = data.data.reduce(
        (sum, entry) => sum + (entry.input_tokens || 0) + (entry.output_tokens || 0),
        0
      );
    } else if (data.input_tokens !== undefined) {
      totalTokens = (data.input_tokens || 0) + (data.output_tokens || 0);
    }

    return res.json({ used: totalTokens });

  } catch (err) {
    // Errore di rete o parsing — non bloccare il dashboard
    return res.status(200).json({ used: 0, error: err.message });
  }
}
