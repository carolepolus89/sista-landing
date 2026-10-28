// Catalogue des events : le prix est fixé ici, jamais par le navigateur.
export const EVENTS = {
  'paint-wine-22-octobre': {
    name: 'Atelier Paint & Wine · SISTA 22 octobre',
    date: 'Jeudi 22 octobre, 18h–22h',
    location: 'Bord de Meuse, Liège',
    page: '/reservation-paint-wine-22-octobre.html',
    price: 'price_1U2pUFAE8C0m7EE9Wrw6Qe5m', // 50€ HTVA + 21% TVA = 60,50€ TTC
    brevoList: 8, // « Sista - Paint & Wine 22/10/26 »
    closed: true, // event passé
  },
  'petit-dejeuner-24-novembre': {
    name: 'Petit-déjeuner créatif · Magnets de Noël · SISTA 24 novembre',
    date: 'Mardi 24 novembre, 9h30–11h30',
    location: 'Bord de Meuse, Liège',
    page: '/reservation-petit-dejeuner-24-novembre.html',
    amountTTC: 4235, // 35€ HTVA + 21% TVA = 42,35€ TTC (en centimes)
    brevoTemplate: 10, // « Ta place est réservée - Breakfast »
    brevoList: 13, // « Sista - Petit-déjeuner 24/11/26 »
  },
};

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
    newsletter, whatsapp, eventId = 'paint-wine-22-octobre',
  } = body || {};

  const ev = EVENTS[eventId];
  if (!ev) {
    return res.status(400).json({ error: 'Event inconnu', eventId });
  }
  if (ev.closed) {
    return res.status(410).json({ error: 'Les réservations sont fermées pour cet event', eventId });
  }

  const required = { firstName, lastName, email, companyName, vatNumber };
  const missing = Object.entries(required).filter(([, v]) => !v || !String(v).trim()).map(([k]) => k);
  if (missing.length) {
    return res.status(400).json({ error: 'Champs manquants', missing });
  }
  if (!email.includes('@')) {
    return res.status(400).json({ error: 'Email invalide' });
  }
  if (whatsapp && !String(phone || '').trim()) {
    return res.status(400).json({ error: 'Téléphone requis pour le groupe WhatsApp' });
  }

  const secretKey = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (!secretKey) {
    return res.status(500).json({ error: 'Stripe secret key manquante' });
  }

  const origin = `https://${req.headers.host}`;

  const params = new URLSearchParams();
  params.append('mode', 'payment');
  if (ev.price) {
    params.append('line_items[0][price]', ev.price);
  } else {
    params.append('line_items[0][price_data][currency]', 'eur');
    params.append('line_items[0][price_data][unit_amount]', String(ev.amountTTC));
    params.append('line_items[0][price_data][product_data][name]', ev.name);
  }
  params.append('line_items[0][quantity]', '1');
  params.append('customer_email', email);
  params.append('success_url', `${origin}/reservation-confirmee.html?event=${eventId}&session_id={CHECKOUT_SESSION_ID}`);
  params.append('cancel_url', `${origin}${ev.page}`);
  params.append('metadata[event]', ev.name);
  params.append('metadata[eventDate]', ev.date);
  params.append('metadata[eventLocation]', ev.location);
  if (ev.brevoTemplate) params.append('metadata[brevoTemplate]', String(ev.brevoTemplate));
  if (ev.brevoList) params.append('metadata[brevoList]', String(ev.brevoList));
  params.append('metadata[firstName]', firstName);
  params.append('metadata[lastName]', lastName);
  params.append('metadata[email]', email);
  params.append('metadata[phone]', phone || '');
  params.append('metadata[instagram]', instagram || '');
  params.append('metadata[companyName]', companyName);
  params.append('metadata[vatNumber]', vatNumber);
  params.append('metadata[newsletter]', newsletter ? 'true' : 'false');
  params.append('metadata[whatsapp]', whatsapp ? 'true' : 'false');

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
