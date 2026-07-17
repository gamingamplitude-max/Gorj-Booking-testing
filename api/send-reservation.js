const nodemailer = require('nodemailer');

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    return res.status(500).json({ error: 'Email service is not configured.' });
  }

  // Body may arrive parsed (Vercel) or as a raw string.
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const {
    firstName = '',
    lastName = '',
    email = '',
    accommodationName,
    accommodation,
    roomTypeName,
    roomType,
    checkin,
    checkout,
    guests,
    message,
    guideIncluded,
    guideFee,
    totalPrice,
  } = body;

  const to = String(email || '').trim();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to);
  if (!emailValid) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }

  const guestName = `${firstName} ${lastName}`.trim() || 'Oaspete';
  const stayName = accommodationName || accommodation || '—';
  const roomName = roomTypeName || roomType || '—';

  const rows = [
    ['Nume', guestName],
    ['Cazare', stayName],
    ['Tip cameră', roomName],
    ['Check-in', formatDate(checkin)],
    ['Check-out', formatDate(checkout)],
    ['Număr persoane', guests || '—'],
    ['Ghid local', guideIncluded ? `Da (+€${guideFee || 0})` : 'Nu'],
    ['Total estimat', totalPrice != null ? `€${totalPrice}` : '—'],
  ];

  const rowsHtml = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;font-size:14px;">${escapeHtml(
          label
        )}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#111;font-size:14px;font-weight:600;">${escapeHtml(
          value
        )}</td></tr>`
    )
    .join('');

  const messageHtml = message
    ? `<p style="margin:16px 0 0;color:#444;font-size:14px;line-height:1.6;"><strong>Mesajul tău:</strong><br>${escapeHtml(
        message
      )}</p>`
    : '';

  const html = `
  <div style="font-family:Georgia,'Times New Roman',serif;max-width:560px;margin:0 auto;padding:24px;background:#fbf9f4;">
    <h1 style="color:#7a5c1e;font-size:22px;margin:0 0 4px;">Rezervare confirmată</h1>
    <p style="color:#555;font-size:15px;margin:0 0 20px;">Bună, ${escapeHtml(
      firstName || guestName
    )}! Îți mulțumim pentru rezervarea făcută prin Gorj Booking. Iată detaliile:</p>
    <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;">
      ${rowsHtml}
    </table>
    ${messageHtml}
    <p style="margin:24px 0 0;color:#888;font-size:12px;">Dacă nu tu ai făcut această rezervare, poți ignora acest email.</p>
  </div>`;

  const text = rows.map(([l, v]) => `${l}: ${v}`).join('\n');

  try {
    // Gmail shows app passwords with spaces (e.g. "abcd efgh ijkl mnop").
    // Those spaces are display-only and must be removed before auth.
    const appPassword = String(GMAIL_APP_PASSWORD).replace(/\s+/g, '');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: String(GMAIL_USER).trim(), pass: appPassword },
    });

    await transporter.verify();

    await transporter.sendMail({
      from: `"Gorj Booking" <${GMAIL_USER}>`,
      to,
      bcc: GMAIL_USER, // keep a copy for the property owner
      replyTo: GMAIL_USER,
      subject: `Rezervarea ta la ${stayName} - Gorj Booking`,
      text,
      html,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.log('[v0] send-reservation error:', err && err.message);
    return res.status(500).json({
      error: 'Failed to send reservation email.',
      detail: err && err.message,
      code: err && err.code,
      responseCode: err && err.responseCode,
    });
  }
};
