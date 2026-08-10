const PRICE_ID = 'price_1U2pUFAE8C0m7EE9Wrw6Qe5m'; // 50€ HTVA + 21% TVA = 60,50€ TTC

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ error: 'Body parse error', detail: e.message });
  }

  const {
    firstName, lastName, email, phone, instagram,
    companyName, vatNumber,
    newsletter, event,
  } = body || {};

  const required = { firstName, lastName, email, companyName, vatNumber };
  const missing = Object.entries(required).filter(([, v]) => !v || !String(v).trim()).map(([k]) => k);
  if (missing.length) {
    return res.status(400).json({ error: 'Champs manquants', missing });
  }
  if (!email.includes('@')) {
    return res.status(400).json({ error: 'Email invalide' });
  }

  const secretKey = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (!secretKey) {
    return res.status(500).json({ error: 'Stripe secret key manquante' });
  }

  const origin = `https://${req.headers.host}`;

  const params = new URLSearchParams();
  params.append('mode', 'payment');
  params.append('line_items[0][price]', PRICE_ID);
  params.append('line_items[0][quantity]', '1');
  params.append('customer_email', email);
  params.append('success_url', `${origin}/reservation-confirmee.html?session_id={CHECKOUT_SESSION_ID}`);
  params.append('cancel_url', `${origin}/reservation-paint-wine-22-octobre.html`);
  params.append('metadata[event]', event || 'Atelier Paint & Wine — SISTA 22 octobre');
  params.append('metadata[firstName]', firstName);
  params.append('metadata[lastName]', lastName);
  params.append('metadata[email]', email);
  params.append('metadata[phone]', phone || '');
  params.append('metadata[instagram]', instagram || '');
  params.append('metadata[companyName]', companyName);
  params.append('metadata[vatNumber]', vatNumber);
  params.append('metadata[newsletter]', newsletter ? 'true' : 'false');

  try {
    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await stripeRes.json();

    if (!stripeRes.ok) {
      return res.status(500).json({ error: 'Stripe error', detail: session });
    }

    return res.status(200).json({ url: session.url });
  } catch (err) {
    return res.status(500).json({ error: 'fetch failed', detail: err.message });
  }
}
