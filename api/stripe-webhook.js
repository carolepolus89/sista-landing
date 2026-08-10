import crypto from 'crypto';

export const config = {
  api: { bodyParser: false },
};

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const TOLERANCE_SECONDS = 5 * 60;

function verifyStripeSignature(rawBody, signatureHeader, secret) {
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((p) => p.split('=').map((s) => s.trim()))
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function sendBrevoEmail(apiKey, sender, to, toName, subject, html) {
  return fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      sender,
      to: [{ email: to, name: toName }],
      subject,
      htmlContent: html,
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  if (!webhookSecret) {
    return res.status(500).json({ error: 'Webhook secret manquant' });
  }

  const rawBody = await getRawBody(req);
  const signatureHeader = req.headers['stripe-signature'];

  if (!signatureHeader || !verifyStripeSignature(rawBody, signatureHeader, webhookSecret)) {
    return res.status(400).json({ error: 'Signature invalide' });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (e) {
    return res.status(400).json({ error: 'Payload invalide' });
  }

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true, ignored: event.type });
  }

  const session = event.data.object;
  if (session.payment_status !== 'paid') {
    return res.status(200).json({ received: true, ignored: 'not paid' });
  }

  const meta = session.metadata || {};
  const {
    firstName = '', lastName = '', email = session.customer_details?.email || '',
    phone = '', instagram = '', companyName = '', vatNumber = '',
    newsletter = 'false', event: eventName = 'Atelier Paint & Wine — SISTA 22 octobre',
  } = meta;

  const apiKey = (process.env.BREVO_API_KEY || '').replace(/^﻿/, '').trim();
  if (!apiKey) {
    return res.status(500).json({ error: 'Brevo API key manquante' });
  }

  const senderEmail = (process.env.BREVO_SENDER_EMAIL || 'carolepolus@gmail.com').trim();
  const senderName = (process.env.BREVO_SENDER_NAME || 'SISTA · Carole Polus').trim();
  const notifyEmail = (process.env.SISTA_NOTIFY_EMAIL || 'carolepolus@gmail.com').trim();
  const sender = { email: senderEmail, name: senderName };

  const safe = {
    firstName: escapeHtml(firstName),
    lastName: escapeHtml(lastName),
    email: escapeHtml(email),
    phone: escapeHtml(phone),
    instagram: escapeHtml(instagram),
    companyName: escapeHtml(companyName),
    vatNumber: escapeHtml(vatNumber),
    eventName: escapeHtml(eventName),
  };

  const customerHtml = `
    <p>Coucou ${safe.firstName},</p>
    <p>Ta place pour l'atelier <strong>Paint &amp; Wine SISTA</strong> est confirmée — ton paiement a bien été reçu !</p>
    <p><strong>Événement :</strong> ${safe.eventName}</p>
    <p><strong>Date :</strong> Mercredi 22 octobre, 18h–22h<br><strong>Lieu :</strong> Bord de Meuse, Liège</p>
    <p>À très vite,<br>Carole</p>
  `;

  const internalHtml = `
    <p>Nouveau paiement confirmé — ${safe.eventName}</p>
    <ul>
      <li><strong>Nom :</strong> ${safe.firstName} ${safe.lastName}</li>
      <li><strong>Email :</strong> ${safe.email}</li>
      <li><strong>Téléphone :</strong> ${safe.phone || '-'}</li>
      <li><strong>Instagram :</strong> ${safe.instagram || '-'}</li>
      <li><strong>Entreprise :</strong> ${safe.companyName}</li>
      <li><strong>N° TVA :</strong> ${safe.vatNumber}</li>
      <li><strong>Newsletter :</strong> ${newsletter === 'true' ? 'oui' : 'non'}</li>
      <li><strong>Montant payé :</strong> ${(session.amount_total / 100).toFixed(2)}€ TTC</li>
    </ul>
  `;

  try {
    await Promise.all([
      sendBrevoEmail(apiKey, sender, email, `${firstName} ${lastName}`, 'Ta place SISTA est confirmée — Atelier Paint & Wine', customerHtml),
      sendBrevoEmail(apiKey, sender, notifyEmail, 'SISTA', `Paiement confirmé — ${firstName} ${lastName}`, internalHtml),
    ]);

    if (newsletter === 'true') {
      await fetch('https://api.brevo.com/v3/contacts', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify({ email, listIds: [7], updateEnabled: true }),
      }).catch(() => {});
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    return res.status(500).json({ error: 'fetch failed', detail: err.message });
  }
}
