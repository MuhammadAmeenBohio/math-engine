import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { emailOTP } from 'better-auth/plugins';
import { mongoDb } from './db/client';
import { Resend } from 'resend';

// Enforce auth secret in production
const authSecret = process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET;
if (!authSecret && process.env.NODE_ENV === 'production') {
  throw new Error('FATAL: BETTER_AUTH_SECRET (or AUTH_SECRET) is required in production.');
}

// The Resend SDK throws in its constructor when given an empty key, so only
// instantiate it when a real key is configured.
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const fromEmail = process.env.RESEND_FROM_EMAIL || 'Math Engine <auth@jamyousuf.me>';

// Dynamic trusted origins supporting production, localhost, and Vercel preview deployments
function getTrustedOrigins(): string[] {
  const origins: string[] = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];

  if (process.env.NEXT_PUBLIC_APP_URL) {
    origins.push(process.env.NEXT_PUBLIC_APP_URL);
  }
  if (process.env.VERCEL_URL) {
    origins.push(`https://${process.env.VERCEL_URL}`);
  }

  return origins;
}

// Only configure Google provider if real credentials are present
const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  };
}

export const auth = betterAuth({
  database: mongodbAdapter(mongoDb),
  secret: authSecret || 'dev-insecure-secret-key-32chars-minimum!',
  baseURL:
    process.env.BETTER_AUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000',
  trustedOrigins: getTrustedOrigins(),
  ...(Object.keys(socialProviders).length > 0 ? { socialProviders } : {}),
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        try {
          if (!resend) {
            if (process.env.NODE_ENV !== 'production') {
              console.log(`[DEV OTP] Verification code for ${email} (${type}): ${otp}`);
            } else {
              console.error(`[AUTH ERROR] Cannot send OTP: RESEND_API_KEY is not configured.`);
            }
            return;
          }

          await resend.emails.send({
            from: fromEmail,
            to: email,
            subject: `Math Engine Verification Code: ${otp}`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F3F7F5; padding: 40px 20px; color: #0F2E22;">
                <div style="max-width: 480px; margin: 0 auto; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #C3DED2; padding: 32px; box-shadow: 0 4px 12px rgba(15, 46, 34, 0.05);">
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 24px;">
                    <span style="font-size: 24px; font-weight: 800; letter-spacing: -0.03em; color: #0F2E22;">Math <span style="color: #1A8F6B;">Engine</span></span>
                  </div>
                  <h2 style="font-size: 20px; font-weight: 700; margin: 0 0 12px; color: #0F2E22;">Your Verification Code</h2>
                  <p style="font-size: 14px; line-height: 1.5; color: rgba(15, 46, 34, 0.7); margin: 0 0 24px;">
                    Enter the following 6-digit code in Math Engine to instantly sign in and sync your deterministic step-by-step math solutions.
                  </p>
                  <div style="background-color: #F3F7F5; border: 2px dashed #1A8F6B; border-radius: 12px; padding: 18px; text-align: center; margin-bottom: 24px;">
                    <span style="font-family: 'SF Mono', Monaco, Inconsolata, monospace; font-size: 32px; font-weight: 800; letter-spacing: 0.25em; color: #0B3D2E;">${otp}</span>
                  </div>
                  <p style="font-size: 12px; color: rgba(15, 46, 34, 0.5); margin: 0;">
                    This code expires in 10 minutes. If you did not request this login, you can safely ignore this email.
                  </p>
                </div>
              </div>
            `,
          });
        } catch (err) {
          console.error('Failed to send OTP via Resend:', err);
          throw new Error('Failed to send verification code. Please try again.');
        }
      },
      expiresIn: 600, // 10 minutes
    }),
  ],
});
