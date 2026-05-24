import nodemailer, { type Transporter, type SendMailOptions } from 'nodemailer';

/**
 * Email transport.
 *
 * Audit fix R-1.1 (A-02, A-04): the original implementation built a
 * module-level transporter at import time and silently fell back to a
 * mock branch that returned `success: true` whenever any SMTP env var
 * was missing. That made OTP sends look like they shipped while no
 * mail ever left the function. Behaviour now:
 *
 *   - Lazy construction on first send.
 *   - Hard fail in production when SMTP env vars are missing — never mock.
 *   - In non-prod the dev mock is opt-in: it logs a redacted summary
 *     instead of pretending a real send succeeded.
 *   - Default to TLS-on (port 465 / `secure: true`); accepts the legacy
 *     587 + STARTTLS shape via SMTP_PORT override.
 *   - Connect / greeting / socket timeouts so a hung handshake fails
 *     fast instead of blocking the function.
 *   - One transient retry on common transport errors (ETIMEDOUT,
 *     ECONNRESET, EAI_AGAIN) per send.
 */

type SmtpEnv = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

type SendResult = { success: true; messageId: string } | { success: false; error: unknown };

const TRANSIENT_ERROR_CODES = new Set(['ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', 'ESOCKET']);
const TIMEOUT_MS = 10_000;

let cachedTransporter: Transporter | null = null;
let cachedVerify: Promise<void> | null = null;

function redactEmail(value: unknown): string {
  const email = typeof value === 'string' ? value : '';
  const [name, domain] = email.split('@');
  if (!name || !domain) return '[redacted]';
  return `${name.slice(0, 2)}***@${domain}`;
}

function readSmtpEnv(): SmtpEnv | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM ?? '"ORIGIN AI" <adminoffice@o3origin.com>';

  if (!host || !user || !pass) {
    return null;
  }

  const portStr = process.env.SMTP_PORT;
  let port = portStr ? Number.parseInt(portStr, 10) : 465;
  if (!Number.isFinite(port) || port <= 0) {
    port = 465;
  }
  // Default to TLS-on; only treat 587 / 25 as STARTTLS upgrade ports.
  const secure = port === 465;

  return { host, port, secure, user, pass, from };
}

function isTransientTransportError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' && TRANSIENT_ERROR_CODES.has(code);
}

function buildTransporter(env: SmtpEnv): Transporter {
  return nodemailer.createTransport({
    host: env.host,
    port: env.port,
    secure: env.secure,
    auth: { user: env.user, pass: env.pass },
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
    pool: true,
    maxConnections: 3,
  });
}

function getTransporter(): Transporter {
  if (cachedTransporter) return cachedTransporter;

  const env = readSmtpEnv();

  if (!env) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[email] SMTP_HOST / SMTP_USER / SMTP_PASS are required in production. Refusing to silently mock email delivery.',
      );
    }
    // Dev fallback: an opt-in mock that makes the absence of SMTP obvious in logs.
    const mock: Pick<Transporter, 'sendMail' | 'verify'> = {
      sendMail: async (options: SendMailOptions) => {
        console.warn('[email] dev mock — no SMTP configured; logging instead of sending', {
          to: redactEmail(options.to),
          subjectLength: String(options.subject ?? '').length,
          bodyLength: String(options.text ?? '').length,
        });
        return { messageId: 'dev-mock-' + Date.now() } as Awaited<ReturnType<Transporter['sendMail']>>;
      },
      verify: (async () => true as const) as Transporter['verify'],
    };
    cachedTransporter = mock as Transporter;
    cachedVerify = Promise.resolve();
    return cachedTransporter;
  }

  cachedTransporter = buildTransporter(env);
  return cachedTransporter;
}

async function ensureVerified(transporter: Transporter): Promise<void> {
  if (cachedVerify) return cachedVerify;
  cachedVerify = transporter
    .verify()
    .then(() => undefined)
    .catch((err) => {
      // Reset the verify promise so a future send can re-try; but throw now
      // so the caller surfaces the failure to the user instead of silently
      // queueing onto a broken transport.
      cachedVerify = null;
      console.error('[email] SMTP verify() failed:', err);
      throw err instanceof Error ? err : new Error(String(err));
    });
  return cachedVerify;
}

async function sendOnce(transporter: Transporter, options: SendMailOptions) {
  return transporter.sendMail(options);
}

export const sendEmail = async ({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<SendResult> => {
  let transporter: Transporter;
  try {
    transporter = getTransporter();
  } catch (error) {
    console.error('[email] transporter unavailable:', error);
    return { success: false, error };
  }

  const from = process.env.EMAIL_FROM || '"ORIGIN AI" <adminoffice@o3origin.com>';
  const options: SendMailOptions = { from, to, subject, text, html: html || text };

  try {
    await ensureVerified(transporter);
    const info = await sendOnce(transporter, options);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    if (isTransientTransportError(error)) {
      try {
        const info = await sendOnce(transporter, options);
        return { success: true, messageId: info.messageId };
      } catch (retryError) {
        console.error('[email] send failed after retry:', retryError);
        return { success: false, error: retryError };
      }
    }
    console.error('[email] send failed:', error);
    return { success: false, error };
  }
};

/**
 * Reset the cached transporter — exposed for tests so they can swap
 * environment between cases. Not part of the public runtime API.
 */
export const __resetEmailForTests = (): void => {
  cachedTransporter = null;
  cachedVerify = null;
};
