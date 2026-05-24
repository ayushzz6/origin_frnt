'use server';

import { withStoreAsync } from '@/server/store';
import { sendEmail } from '@/server/email';

/**
 * Generates a 6-digit random OTP.
 */
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Action to send an OTP to a specific email.
 */
export async function sendOtpAction(
  email: string,
  role?: 'student' | 'teacher' | 'admin' | null,
) {
  if (!email) {
    return { ok: false, message: 'Email is required' };
  }

  const normalizedEmail = normalizeEmail(email);
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes from now

  try {
    const preflight = await withStoreAsync(async (store) => {
      // "Already exists" check must be role-scoped: the same email can legally
      // be both a student and a teacher row (UNIQUE constraint is on
      // (email, role)). Without this scoping the preflight silently blocks
      // OTP delivery for a teacher signup whenever a student row with the
      // same email happens to be cached in the in-memory store.
      const userExists = store.users.find((u) => {
        if (u.email.toLowerCase() !== normalizedEmail) return false;
        if (u.role === 'admin') return false; // admins always allowed to re-OTP
        return role ? u.role === role : true;
      });
      if (userExists) {
        return { ok: false as const, message: 'An account with this email already exists. Please login instead.' };
      }

      // Audit fix R-1.2 (A-05): the prior `o.email !== email` filter was
      // case-sensitive, so a previous send to "Foo@Bar.com" plus a new send
      // to "foo@bar.com" left two rows. Normalise both sides to keep the
      // dedup contract honest.
      store.otps = store.otps.filter((o) => o.email.toLowerCase() !== normalizedEmail);
      store.otps.push({ email: normalizedEmail, otp, expiresAt });
      return { ok: true as const };
    });

    if (!preflight.ok) {
      return preflight;
    }

    // Send email
    const emailResult = await sendEmail({
      to: normalizedEmail,
      subject: 'Verify your ORIGIN account',
      text: `Your verification code is: ${otp}. This code will expire in 5 minutes.`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #1d4ed8;">Welcome to ORIGIN</h2>
          <p>Please use the following code to verify your account registration:</p>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #111;">
            ${otp}
          </div>
          <p style="color: #666; font-size: 14px; margin-top: 20px;">
            This code will expire in 5 minutes. If you did not request this, please ignore this email.
          </p>
        </div>
      `,
    });

    if (!emailResult.success) {
      return { ok: false, message: 'Failed to send verification email.' };
    }

    return { ok: true, message: 'Verification code sent to your email.' };
  } catch (error) {
    console.error('sendOtpAction error:', error);
    return { ok: false, message: 'An error occurred while sending OTP.' };
  }
}

/**
 * Action to verify the OTP for an email.
 */
export async function verifyOtpAction(email: string, otp: string) {
  if (!email || !otp) {
    return { ok: false, message: 'Email and verification code are required.' };
  }

  const normalizedEmail = normalizeEmail(email);

  try {
    return await withStoreAsync(async (store) => {
      const storedOtp = store.otps.find(
        (o) => o.email.toLowerCase() === normalizedEmail && o.otp === otp,
      );

      if (!storedOtp) {
        return { ok: false, message: 'Invalid verification code.' };
      }

      const now = new Date();
      const expiry = new Date(storedOtp.expiresAt);

      if (now > expiry) {
        store.otps = store.otps.filter((o) => o.email.toLowerCase() !== normalizedEmail);
        return { ok: false, message: 'Verification code has expired. Please request a new one.' };
      }

      storedOtp.verified = true;
      storedOtp.expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      return { ok: true, message: 'Email verified successfully.' };
    });
  } catch (error) {
    console.error('verifyOtpAction error:', error);
    return { ok: false, message: 'An error occurred while verifying code.' };
  }
}
