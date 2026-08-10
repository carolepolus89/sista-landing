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

async function sendBrevoTemplate(apiKey, sender, to, toName, templateId, params) {
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
      templateId: Number(templateId),
      params,
    }),
  });
}

async function sendBrevoHtml(apiKey, sender, to, toName, subject, html) {
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

function internalNotificationHtml(safe, newsletter, amountPaid) {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EFF0E6;padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background-color:#ffffff;border:1.5px solid #241827;border-radius:20px;overflow:hidden;">
        <tr>
          <td style="background-color:#E63C90;padding:22px 32px;">
            <p style="margin:0;font-family:'Courier New', monospace;font-weight:bold;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#EEF0A6;">Nouveau paiement confirmé</p>
            <h1 style="margin:6px 0 0;font-family:Georgia, serif;font-weight:bold;font-size:20px;color:#EFF0E6;">${safe.eventName}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;">
            <table role="presentation" width="100%" style="border-collapse:collapse;font-family:Helvetica, Arial, sans-serif;">
              <tr><td style="padding:10px 0;border-bottom:1px solid #e5e0d8;font-size:13px;color:#241827;opacity:.6;">Nom</td><td style="padding:10px 0;border-bottom:1px solid #e5e0d8;font-size:14px;color:#241827;font-weight:bold;text-align:right;">${safe.firstName} ${safe.lastName}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #e5e0d8;font-size:13px;color:#241827;opacity:.6;">Email</td><td style="padding:10px 0;border-bottom:1px solid #e5e0d8;font-size:14px;color:#241827;text-align:right;">${safe.email}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #e5e0d8;font-size:13px;color:#241827;opacity:.6;">Téléphone</td><td style="padding:10px 0;border-bottom:1px solid #e5e0d8;font-size:14px;color:#241827;text-align:right;">${safe.phone || '-'}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #e5e0d8;font-size:13px;color:#241827;opacity:.6;">Instagram</td><td style="padding:10px 0;border-bottom:1px solid #e5e0d8;font-size:14px;color:#241827;text-align:right;">${safe.instagram || '-'}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #e5e0d8;font-size:13px;color:#241827;opacity:.6;">Entreprise</td><td style="padding:10px 0;border-bottom:1px solid #e5e0d8;font-size:14px;color:#241827;font-weight:bold;text-align:right;">${safe.companyName}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #e5e0d8;font-size:13px;color:#241827;opacity:.6;">N° TVA</td><td style="padding:10px 0;border-bottom:1px solid #e5e0d8;font-size:14px;color:#241827;font-family:'Courier New',monospace;text-align:right;">${safe.vatNumber}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #e5e0d8;font-size:13px;color:#241827;opacity:.6;">Newsletter</td><td style="padding:10px 0;border-bottom:1px solid #e5e0d8;font-size:14px;color:#241827;text-align:right;">${newsletter === 'true' ? 'oui' : 'non'}</td></tr>
              <tr><td style="padding:14px 0 0;font-size:13px;color:#241827;opacity:.6;">Montant payé</td><td style="padding:14px 0 0;font-size:18px;color:#2E4ED8;font-weight:bold;text-align:right;">${amountPaid}</td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background-color:#241827;padding:16px 32px;text-align:center;">
            <p style="margin:0;font-family:'Courier New', monospace;font-size:10px;letter-spacing:.08em;color:#EFF0E6;opacity:.6;">Notification automatique — SISTA</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
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

  const customerTemplateId = process.env.BREVO_TEMPLATE_RESERVATION_CONFIRMEE;
  if (!customerTemplateId) {
    return res.status(500).json({ error: 'ID de template Brevo manquant (BREVO_TEMPLATE_RESERVATION_CONFIRMEE)' });
  }

  const senderEmail = (process.env.BREVO_SENDER_EMAIL || 'carole@luvia.be').trim();
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

  const customerParams = {
    firstName: safe.firstName,
    lastName: safe.lastName,
    eventName: safe.eventName,
    eventDate: 'Mercredi 22 octobre, 18h–22h',
    eventLocation: 'Bord de Meuse, Liège',
  };

  const amountPaid = `${(session.amount_total / 100).toFixed(2)}€ TTC`;
  const internalHtml = internalNotificationHtml(safe, newsletter, amountPaid);

  try {
    await Promise.all([
      sendBrevoTemplate(apiKey, sender, email, `${firstName} ${lastName}`, customerTemplateId, customerParams),
      sendBrevoHtml(apiKey, sender, notifyEmail, 'SISTA', `Paiement confirmé — ${firstName} ${lastName}`, internalHtml),
    ]);

    const eventAttendeesListId = Number(process.env.BREVO_LIST_EVENT_ATTENDEES);
    const listIds = eventAttendeesListId ? [eventAttendeesListId] : [];
    if (newsletter === 'true') listIds.push(7);

    if (listIds.length) {
      await fetch('https://api.brevo.com/v3/contacts', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify({ email, listIds, updateEnabled: true, attributes: { FIRSTNAME: firstName } }),
      }).catch(() => {});
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    return res.status(500).json({ error: 'fetch failed', detail: err.message });
  }
}
