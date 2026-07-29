/**
 * Email Service — Resend REST API
 *
 * Sends transactional email (password reset, email verification) via the
 * Resend HTTP API. Uses plain fetch against https://api.resend.com — no SDK
 * dependency.
 *
 * Configuration (see .env.example):
 *   RESEND_API_KEY — required in production. Without it the service falls
 *                    back to logging the email to the console (dev mode).
 *   EMAIL_FROM     — sender identity, e.g. "Synthesis Engine <noreply@example.com>"
 *   FRONTEND_URL   — base URL used to build reset/verify links
 */

const RESEND_API_URL = 'https://api.resend.com/emails';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendEmailResult {
  sent: boolean;
  /** true when no RESEND_API_KEY is configured and the mail was only logged */
  devFallback: boolean;
}

/**
 * Send an email via Resend. Without RESEND_API_KEY the email is logged to
 * the console instead (local development).
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'Synthesis Engine <onboarding@resend.dev>';

  if (!apiKey) {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║  ✉  EMAIL (dev fallback — RESEND_API_KEY not set)        ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log(`  To:      ${options.to}`);
    console.log(`  Subject: ${options.subject}`);
    console.log(`  Text:\n${options.text}`);
    return { sent: false, devFallback: true };
  }

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Resend API error (${response.status}): ${errorBody}`);
  }

  return { sent: true, devFallback: false };
}

// ============================================================================
// TRANSACTIONAL TEMPLATES
// ============================================================================

function getFrontendUrl(): string {
  return process.env.FRONTEND_URL || 'http://localhost:5173';
}

/**
 * Password reset email with a link containing the PLAINTEXT token (the DB
 * only stores its SHA-256 digest, see hashToken in services/auth.ts).
 */
export async function sendPasswordResetEmail(email: string, resetToken: string): Promise<SendEmailResult> {
  const resetUrl = `${getFrontendUrl()}/reset-password?token=${encodeURIComponent(resetToken)}`;

  const text = [
    'Hallo,',
    '',
    'du hast eine Zurücksetzung deines Passworts angefordert.',
    'Klicke auf den folgenden Link, um ein neues Passwort zu setzen (gültig für 1 Stunde):',
    '',
    resetUrl,
    '',
    'Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.',
    '',
    '— Synthesis Engine',
  ].join('\n');

  const html = `
    <p>Hallo,</p>
    <p>du hast eine Zurücksetzung deines Passworts angefordert.</p>
    <p><a href="${resetUrl}">Passwort zurücksetzen</a> (gültig für 1 Stunde)</p>
    <p style="color:#666;font-size:12px">Falls der Button nicht funktioniert:<br>${resetUrl}</p>
    <p>Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.</p>
    <p>— Synthesis Engine</p>
  `;

  return sendEmail({
    to: email,
    subject: 'Passwort zurücksetzen — Synthesis Engine',
    html,
    text,
  });
}

/**
 * Email verification email with a link containing the PLAINTEXT token.
 */
export async function sendVerificationEmail(email: string, verifyToken: string): Promise<SendEmailResult> {
  const verifyUrl = `${getFrontendUrl()}/verify-email?token=${encodeURIComponent(verifyToken)}`;

  const text = [
    'Hallo,',
    '',
    'willkommen bei Synthesis Engine! Bitte bestätige deine E-Mail-Adresse',
    'mit einem Klick auf den folgenden Link:',
    '',
    verifyUrl,
    '',
    '— Synthesis Engine',
  ].join('\n');

  const html = `
    <p>Hallo,</p>
    <p>willkommen bei Synthesis Engine! Bitte bestätige deine E-Mail-Adresse:</p>
    <p><a href="${verifyUrl}">E-Mail-Adresse bestätigen</a></p>
    <p style="color:#666;font-size:12px">Falls der Button nicht funktioniert:<br>${verifyUrl}</p>
    <p>— Synthesis Engine</p>
  `;

  return sendEmail({
    to: email,
    subject: 'E-Mail-Adresse bestätigen — Synthesis Engine',
    html,
    text,
  });
}
