export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let email, firstName;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    email = body?.email;
    firstName = (body?.firstName || '').trim();
  } catch (e) {
    return res.status(400).json({ error: 'Body parse error', detail: e.message });
  }

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Email invalide' });
  }
  if (!firstName) {
    return res.status(400).json({ error: 'Prénom manquant' });
  }

  const apiKey = (process.env.BREVO_API_KEY || '').replace(/^﻿/, '').trim();
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
      body: JSON.stringify({
        email,
        listIds: [7],
        updateEnabled: true,
        attributes: { FIRSTNAME: firstName },
      }),
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }

    const contactOk = response.ok || response.status === 204 || (data && data.code === 'duplicate_parameter');
    if (!contactOk) {
      return res.status(500).json({ error: 'Brevo error', status: response.status, detail: data });
    }

    const welcomeTemplateId = process.env.BREVO_TEMPLATE_NEWSLETTER_BIENVENUE;
    if (welcomeTemplateId) {
      const senderEmail = (process.env.BREVO_SENDER_EMAIL || 'carole@luvia.be').trim();
      const senderName = (process.env.BREVO_SENDER_NAME || 'SISTA · Carole Polus').trim();
      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify({
          sender: { email: senderEmail, name: senderName },
          to: [{ email, name: firstName }],
          templateId: Number(welcomeTemplateId),
          params: { firstName },
        }),
      }).catch(() => {});
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'fetch failed', detail: err.message });
  }
}
