import nodemailer from 'nodemailer';

const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@ibm-recap.com';
const APP_URL = process.env.APP_URL || 'http://localhost:8787';
const SMTP_URL = process.env.SMTP_URL || '';
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_SECURE = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';

let cachedTransporter = null;

export function validateIBMEmail(email) {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@(ibm\.com|us\.ibm\.com)$/i;
  return emailRegex.test(email);
}

export function buildVerificationLink(code) {
  return `${APP_URL}/api/auth/verify?token=${encodeURIComponent(code)}`;
}

function hasSmtpConfiguration() {
  return Boolean(SMTP_URL || (SMTP_HOST && SMTP_PORT));
}

function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  if (!hasSmtpConfiguration()) {
    return null;
  }

  if (SMTP_URL) {
    cachedTransporter = nodemailer.createTransport(SMTP_URL);
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE || SMTP_PORT === 465,
    auth: SMTP_USER || SMTP_PASS
      ? {
          user: SMTP_USER,
          pass: SMTP_PASS
        }
      : undefined
  });

  return cachedTransporter;
}

async function sendEmail({ to, subject, text, html, fallbackLogLines }) {
  const transporter = getTransporter();

  if (!transporter) {
    console.log('\n📧 ========================================');
    console.log(`   ${subject.toUpperCase()}`);
    console.log('========================================');
    console.log(`To: ${to}`);
    console.log(`From: ${EMAIL_FROM}`);
    fallbackLogLines.forEach((line) => console.log(line));
    console.log('========================================\n');
    return { delivered: false, fallback: true };
  }

  await transporter.sendMail({
    from: EMAIL_FROM,
    to,
    subject,
    text,
    html
  });

  return { delivered: true, fallback: false };
}

export async function sendVerificationEmail(email, verificationCode) {
  const verificationLink = buildVerificationLink(verificationCode);
  const subject = 'Verify your IBM Recap account';
  const text = [
    'Verify your IBM Recap account',
    '',
    `Verification code: ${verificationCode}`,
    '',
    'Enter this 6-digit code in IBM Recap, or open the verification link below:',
    verificationLink,
    '',
    'This link and code will expire in 24 hours.'
  ].join('\n');
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #161616;">
      <h1 style="font-size: 24px; margin-bottom: 8px;">IBM Recap</h1>
      <p style="font-size: 16px; margin-bottom: 24px;">Verify your account to start transcribing and summarizing Teams meetings.</p>
      <div style="border: 1px solid #d0d7de; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: #525252; margin-bottom: 8px;">Verification code</div>
        <div style="font-size: 32px; font-weight: 700; letter-spacing: 0.18em; color: #0f62fe;">${verificationCode}</div>
      </div>
      <p style="font-size: 15px; line-height: 1.6; margin-bottom: 20px;">You can enter this code in the IBM Recap signup screen, or click the button below to verify instantly.</p>
      <a href="${verificationLink}" style="display: inline-block; background: #0f62fe; color: white; text-decoration: none; padding: 12px 18px; border-radius: 8px; font-weight: 600; margin-bottom: 20px;">Verify Email</a>
      <p style="font-size: 13px; color: #525252; line-height: 1.5;">This verification link and code expire in 24 hours. If you did not request this, you can ignore this email.</p>
      <p style="font-size: 13px; color: #525252; line-height: 1.5;">If the button does not work, copy and paste this link into your browser:<br /><a href="${verificationLink}" style="color: #0f62fe;">${verificationLink}</a></p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject,
    text,
    html,
    fallbackLogLines: [
      '',
      `Verification Code: ${verificationCode}`,
      '',
      'Verification Link:',
      verificationLink,
      '',
      'Enter the code in IBM Recap or open the link to complete account setup.'
    ]
  });
}

export async function sendPasswordResetEmail(email, token) {
  const resetUrl = `${APP_URL}/api/auth/reset-password?token=${encodeURIComponent(token)}`;
  const subject = 'Reset your IBM Recap password';
  const text = [
    'Reset your IBM Recap password',
    '',
    'Open the link below to choose a new password:',
    resetUrl,
    '',
    'This reset link will expire in 1 hour.'
  ].join('\n');
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #161616;">
      <h1 style="font-size: 24px; margin-bottom: 8px;">IBM Recap</h1>
      <p style="font-size: 16px; margin-bottom: 24px;">Open the link below to reset your password.</p>
      <a href="${resetUrl}" style="display: inline-block; background: #0f62fe; color: white; text-decoration: none; padding: 12px 18px; border-radius: 8px; font-weight: 600;">Reset Password</a>
      <p style="font-size: 13px; color: #525252; line-height: 1.5; margin-top: 20px;">This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject,
    text,
    html,
    fallbackLogLines: [
      '',
      'Reset Link:',
      resetUrl
    ]
  });
}

export async function sendWelcomeEmail(email, fullName) {
  const subject = 'Welcome to IBM Recap';
  const displayName = fullName || 'there';
  const text = [
    `Hi ${displayName},`,
    '',
    'Your IBM Recap account has been verified successfully.',
    `You can now sign in at ${APP_URL} and start using the app.`
  ].join('\n');
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #161616;">
      <h1 style="font-size: 24px; margin-bottom: 8px;">Welcome to IBM Recap</h1>
      <p style="font-size: 16px; margin-bottom: 16px;">Hi ${displayName},</p>
      <p style="font-size: 15px; line-height: 1.6; margin-bottom: 20px;">Your account has been verified successfully. You can now sign in and start transcribing and summarizing Teams meetings.</p>
      <a href="${APP_URL}" style="display: inline-block; background: #0f62fe; color: white; text-decoration: none; padding: 12px 18px; border-radius: 8px; font-weight: 600;">Open IBM Recap</a>
    </div>
  `;

  return sendEmail({
    to: email,
    subject,
    text,
    html,
    fallbackLogLines: [
      '',
      `Hi ${displayName},`,
      '',
      `Your account has been verified successfully. Open IBM Recap at ${APP_URL}.`
    ]
  });
}

console.log('✅ Email utilities initialized');
