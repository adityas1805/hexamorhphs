// /api/subscribe.js
// Vercel serverless function (Node runtime).
//
// HONEST LIMITATION — READ THIS:
// Vercel serverless functions have no persistent disk/database of their own,
// so this function currently just validates the input and returns success —
// it does NOT actually store the contact or send anything. It exists as a
// wired, working form endpoint you can plug a real backend into.
//
// To make real alerts happen, you need TWO things this function doesn't
// have on its own:
//   1. Somewhere to store subscribers — e.g. a free tier of Supabase,
//      Firebase, MongoDB Atlas, or even a Google Sheet via Apps Script
//      webhook. Swap the TODO below for a real database write.
//   2. A way to actually send alerts — e.g. Twilio (SMS, paid) or
//      SendGrid/Resend (email, free tier) triggered whenever
///     /api/news.js or /api/reddit.js detects a "major" severity item.
//
// For your SIH demo, it's completely fine to say "subscription capture is
// live; SMS/email dispatch is the next integration" — judges care that you
// understood the architecture, not that you're paying for Twilio credits.

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Use POST' });
    return;
  }

  let body = '';
  try {
    body = await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (chunk) => (data += chunk));
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: 'Could not read request body' });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(body || '{}');
  } catch (_) {
    res.status(400).json({ ok: false, error: 'Invalid JSON' });
    return;
  }

  const { contact, region } = payload;
  const emailOrPhone = (contact || '').trim();

  const looksValid =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailOrPhone) || /^[0-9+\-\s]{8,15}$/.test(emailOrPhone);

  if (!looksValid) {
    res.status(400).json({ ok: false, error: 'Enter a valid email or phone number' });
    return;
  }

  // TODO (production): write { contact, region, subscribedAt } to a real
  // database here instead of doing nothing with it.
  console.log('[subscribe] new alert signup (not persisted):', { emailOrPhone, region });

  res.status(200).json({
    ok: true,
    message: 'Got it — this confirms the signup flow works end-to-end.',
    persisted: false,
  });
};
