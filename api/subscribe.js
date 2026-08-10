export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let email;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    email = body?.email;
  } catch (e) {
    return res.status(400).json({ error: 'Body parse error', detail: e.message });
  }

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Email invalide' });
  }

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key manquante' });
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({ email, listIds: [7], updateEnabled: true }),
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }

    if (response.ok || response.status === 204 || (data && data.code === 'duplicate_parameter')) {
      return res.status(200).json({ success: true });
    }

    return res.status(500).json({ error: 'Brevo error', status: response.status, detail: data });
  } catch (err) {
    return res.status(500).json({ error: 'fetch failed', detail: err.message });
  }
}
