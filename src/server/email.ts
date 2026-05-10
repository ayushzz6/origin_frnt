import nodemailer from 'nodemailer';

/**
 * Email utility to send OTP and other notifications.
 * In development, it uses a mock transporter that logs to console.
 * In production, it requires SMTP credentials in environment variables.
 */

function redactEmail(value: unknown): string {
  const email = typeof value === 'string' ? value : '';
  const [name, domain] = email.split('@');
  if (!name || !domain) return '[redacted]';
  return `${name.slice(0, 2)}***@${domain}`;
}

const createTransporter = () => {
  // Check for real SMTP credentials
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT || '587'),
      secure: SMTP_PORT === '465', // true for 465, false for other ports
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }

  // Fallback to mock/log-only in development
  return {
    sendMail: async (options: any) => {
      console.warn('[email] Mock email generated', {
        to: redactEmail(options.to),
        subjectLength: String(options.subject ?? '').length,
        bodyLength: String(options.text ?? '').length,
      });
      return { messageId: 'mock-id-' + Date.now() };
    },
  } as any;
};

const transporter = createTransporter();

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
}) => {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"ORIGIN AI" <adminoffice@o3origin.com>',
      to,
      subject,
      text,
      html: html || text,
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error };
  }
};
