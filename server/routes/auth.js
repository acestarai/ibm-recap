import express from 'express';
import { supabase } from '../auth/supabase.js';
import { hashPassword, comparePassword, validatePassword } from '../auth/password.js';
import { generateToken, generateRandomToken, generateVerificationCode, hashToken } from '../auth/jwt.js';
import { validateIBMEmail, sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail, buildVerificationLink } from '../auth/email.js';
import { authenticate } from '../auth/middleware.js';

const router = express.Router();
const VERIFICATION_CODE_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_STORAGE_LIMIT_MB = Number(process.env.STORAGE_LIMIT_MB || 50);
const DEFAULT_STORAGE_LIMIT_BYTES = DEFAULT_STORAGE_LIMIT_MB * 1024 * 1024;

function formatUser(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    createdAt: user.created_at || null,
    lastLogin: user.last_login || null,
    emailVerified: user.email_verified
  };
}

async function getStorageUsage(userId) {
  const { data: files, error } = await supabase
    .from('files')
    .select('file_type, file_size, created_at')
    .eq('user_id', userId);

  if (error) {
    throw error;
  }

  const usage = {
    totalBytes: 0,
    totalFiles: files.length,
    audioBytes: 0,
    transcriptBytes: 0,
    summaryBytes: 0,
    audioCount: 0,
    transcriptCount: 0,
    summaryCount: 0,
    latestActivityAt: null,
    storageLimitBytes: DEFAULT_STORAGE_LIMIT_BYTES,
    remainingBytes: DEFAULT_STORAGE_LIMIT_BYTES
  };

  for (const file of files) {
    const fileSize = Number(file.file_size || 0);

    if (file.file_type === 'audio') {
      usage.audioBytes += fileSize;
      usage.audioCount += 1;
    } else if (file.file_type === 'transcript') {
      usage.totalBytes += fileSize;
      usage.transcriptBytes += fileSize;
      usage.transcriptCount += 1;
    } else if (file.file_type === 'summary') {
      usage.totalBytes += fileSize;
      usage.summaryBytes += fileSize;
      usage.summaryCount += 1;
    }

    if (!usage.latestActivityAt || new Date(file.created_at) > new Date(usage.latestActivityAt)) {
      usage.latestActivityAt = file.created_at;
    }
  }

  usage.remainingBytes = Math.max(usage.storageLimitBytes - usage.totalBytes, 0);

  return usage;
}

async function issueVerificationCode(userId, email) {
  const verificationCode = generateVerificationCode();
  const verificationCodeHash = hashToken(verificationCode);
  const verificationTokenExpires = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);

  const { error } = await supabase
    .from('users')
    .update({
      verification_token: verificationCodeHash,
      verification_token_expires: verificationTokenExpires.toISOString(),
      email_verified: false
    })
    .eq('id', userId);

  if (error) {
    throw error;
  }

  await sendVerificationEmail(email, verificationCode);
  return {
    verificationCode,
    verificationLink: buildVerificationLink(verificationCode)
  };
}

function renderVerificationPage({ title, message, success }) {
  const accent = success ? '#24a148' : '#da1e28';
  const actionLabel = success ? 'Open IBM Recap' : 'Back to IBM Recap';

  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${title}</title>
      <style>
        body {
          margin: 0;
          font-family: Arial, sans-serif;
          background: #161616;
          color: #f4f4f4;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 24px;
        }
        .card {
          width: 100%;
          max-width: 560px;
          background: #262626;
          border: 1px solid #393939;
          border-radius: 16px;
          padding: 32px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
        }
        .eyebrow {
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #8d8d8d;
          margin-bottom: 12px;
        }
        h1 {
          margin: 0 0 12px 0;
          font-size: 32px;
        }
        p {
          margin: 0 0 24px 0;
          line-height: 1.6;
          color: #c6c6c6;
        }
        .status {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: ${accent};
          font-weight: 700;
          margin-bottom: 20px;
        }
        a {
          display: inline-block;
          background: #0f62fe;
          color: #ffffff;
          text-decoration: none;
          padding: 12px 18px;
          border-radius: 8px;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="eyebrow">IBM Recap</div>
        <div class="status">${success ? '✓' : '!' } ${success ? 'Verification complete' : 'Verification issue'}</div>
        <h1>${title}</h1>
        <p>${message}</p>
        <a href="${process.env.APP_URL || 'http://localhost:8787'}">${actionLabel}</a>
      </div>
    </body>
  </html>`;
}

/**
 * POST /api/auth/register
 * Register new user with supported IBM email domains
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Validate IBM email
    if (!validateIBMEmail(email)) {
      return res.status(400).json({ 
        error: 'Only IBM email addresses (@ibm.com or @us.ibm.com) are allowed',
        code: 'INVALID_EMAIL_DOMAIN'
      });
    }
    
    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ 
        error: passwordValidation.errors.join(', '),
        code: 'WEAK_PASSWORD'
      });
    }
    
    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email_verified')
      .eq('email', email.toLowerCase())
      .single();
    
    if (existingUser) {
      if (!existingUser.email_verified) {
        await issueVerificationCode(existingUser.id, email.toLowerCase());
        return res.status(200).json({
          message: 'A verification email with a 6-digit code and verification link has been sent. Use either one to complete registration.',
          requiresVerification: true,
          email: email.toLowerCase()
        });
      }

      return res.status(400).json({
        error: 'User already exists. Please log in.',
        code: 'USER_EXISTS'
      });
    }
    
    // Hash password
    const passwordHash = await hashPassword(password);
    
    // Create user as unverified, then send a verification code
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        email: email.toLowerCase(),
        password_hash: passwordHash,
        full_name: fullName || null,
        email_verified: false
      })
      .select('id, email, full_name')
      .single();
    
    if (error) {
      console.error('Error creating user:', error);
      return res.status(500).json({
        error: 'Failed to create user. Please try again.',
        code: 'CREATE_USER_FAILED'
      });
    }
    
    await issueVerificationCode(user.id, user.email);
    
    res.status(201).json({
      message: 'Account created. Check your email for a 6-digit verification code and verification link to activate it.',
      requiresVerification: true,
      email: user.email,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      error: 'Registration failed. Please try again.',
      code: 'REGISTRATION_FAILED'
    });
  }
});

/**
 * POST /api/auth/login
 * Login user with email and password
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Get user
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, password_hash, full_name, email_verified')
      .eq('email', email.toLowerCase())
      .single();
    
    if (error || !user) {
      return res.status(401).json({
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }
    
    // Compare password
    const passwordMatch = await comparePassword(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ 
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    if (!user.email_verified) {
      return res.status(403).json({
        error: 'Email not verified. Check your inbox for the verification code or verification link.',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }
    
    // Generate JWT token
    const token = generateToken(user.id, user.email);
    
    // Update last login
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);
    
    // Create session
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    await supabase
      .from('sessions')
      .insert({
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });
    
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Login failed. Please try again.',
      code: 'LOGIN_FAILED'
    });
  }
});

/**
 * GET /api/auth/verify
 * Verify email address with legacy token link
 */
router.get('/verify', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res
        .status(400)
        .send(renderVerificationPage({
          title: 'Verification link missing',
          message: 'The verification link is incomplete. Return to IBM Recap and request a new verification email.',
          success: false
        }));
    }
    
    const tokenHash = hashToken(token);
    
    // Find user with this token
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, full_name, verification_token_expires')
      .eq('verification_token', tokenHash)
      .single();
    
    if (error || !user) {
      return res
        .status(400)
        .send(renderVerificationPage({
          title: 'Verification link is invalid',
          message: 'This verification link is not recognized. Request a fresh email from the IBM Recap signup screen and try again.',
          success: false
        }));
    }
    
    // Check if token expired
    if (new Date(user.verification_token_expires) < new Date()) {
      return res
        .status(400)
        .send(renderVerificationPage({
          title: 'Verification link has expired',
          message: 'This verification link expired. Return to IBM Recap and request a new verification email.',
          success: false
        }));
    }
    
    // Update user
    await supabase
      .from('users')
      .update({
        email_verified: true,
        verification_token: null,
        verification_token_expires: null
      })
      .eq('id', user.id);
    
    // Send welcome email
    await sendWelcomeEmail(user.email, user.full_name);
    
    res.send(renderVerificationPage({
      title: 'Email verified successfully',
      message: 'Your IBM Recap account is now active. You can return to the app and sign in.',
      success: true
    }));
  } catch (error) {
    console.error('Verification error:', error);
    res
      .status(500)
      .send(renderVerificationPage({
        title: 'Verification failed',
        message: 'IBM Recap could not complete verification right now. Please return to the app and request another verification email.',
        success: false
      }));
  }
});

/**
 * POST /api/auth/verify-code
 * Verify email address with emailed one-time code
 */
router.post('/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        error: 'Email and verification code are required',
        code: 'MISSING_VERIFICATION_FIELDS'
      });
    }

    const normalizedEmail = email.toLowerCase();
    const normalizedCode = String(code).trim();
    const codeHash = hashToken(normalizedCode);

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, full_name, email_verified, verification_token, verification_token_expires')
      .eq('email', normalizedEmail)
      .single();

    if (error || !user) {
      return res.status(400).json({
        error: 'Invalid email or verification code',
        code: 'INVALID_VERIFICATION_CODE'
      });
    }

    if (user.email_verified) {
      return res.json({
        message: 'Email is already verified. You can sign in.',
        success: true,
        alreadyVerified: true
      });
    }

    if (!user.verification_token || user.verification_token !== codeHash) {
      return res.status(400).json({
        error: 'Invalid email or verification code',
        code: 'INVALID_VERIFICATION_CODE'
      });
    }

    if (!user.verification_token_expires || new Date(user.verification_token_expires) < new Date()) {
      return res.status(400).json({
        error: 'Verification code has expired. Please request a new one.',
        code: 'TOKEN_EXPIRED'
      });
    }

    await supabase
      .from('users')
      .update({
        email_verified: true,
        verification_token: null,
        verification_token_expires: null
      })
      .eq('id', user.id);

    await sendWelcomeEmail(user.email, user.full_name);

    res.json({
      message: 'Email verified successfully! You can now log in.',
      success: true
    });
  } catch (error) {
    console.error('Verify code error:', error);
    res.status(500).json({
      error: 'Verification failed. Please try again.',
      code: 'VERIFICATION_FAILED'
    });
  }
});

/**
 * POST /api/auth/resend-verification
 * Resend verification email
 */
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Get user
    const { data: user } = await supabase
      .from('users')
      .select('id, email, email_verified')
      .eq('email', email.toLowerCase())
      .single();
    
    // Always return success (don't reveal if user exists)
    if (!user) {
      return res.json({ message: 'If an account exists, a verification email has been sent.' });
    }
    
    if (user.email_verified) {
      return res.json({ message: 'Email is already verified. You can log in.' });
    }
    
    await issueVerificationCode(user.id, user.email);
    
    res.json({ message: 'If an account exists, a verification email with a code and verification link has been sent.' });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ 
      error: 'Failed to resend verification email',
      code: 'RESEND_FAILED'
    });
  }
});

/**
 * POST /api/auth/forgot-password
 * Request password reset
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Get user
    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .single();
    
    // Always return success (don't reveal if user exists)
    if (!user) {
      return res.json({ message: 'If an account exists, a password reset email has been sent.' });
    }
    
    // Generate reset token
    const resetToken = generateRandomToken();
    const resetTokenHash = hashToken(resetToken);
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    
    // Update user
    await supabase
      .from('users')
      .update({
        reset_token: resetTokenHash,
        reset_token_expires: resetTokenExpires.toISOString()
      })
      .eq('id', user.id);
    
    // Send reset email
    await sendPasswordResetEmail(email, resetToken);
    
    res.json({ message: 'If an account exists, a password reset email has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ 
      error: 'Failed to process request',
      code: 'FORGOT_PASSWORD_FAILED'
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }
    
    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ 
        error: passwordValidation.errors.join(', '),
        code: 'WEAK_PASSWORD'
      });
    }
    
    const tokenHash = hashToken(token);
    
    // Find user with this token
    const { data: user, error } = await supabase
      .from('users')
      .select('id, reset_token_expires')
      .eq('reset_token', tokenHash)
      .single();
    
    if (error || !user) {
      return res.status(400).json({ 
        error: 'Invalid reset token',
        code: 'INVALID_TOKEN'
      });
    }
    
    // Check if token expired
    if (new Date(user.reset_token_expires) < new Date()) {
      return res.status(400).json({ 
        error: 'Reset token has expired. Please request a new one.',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    // Hash new password
    const passwordHash = await hashPassword(password);
    
    // Update user
    await supabase
      .from('users')
      .update({
        password_hash: passwordHash,
        reset_token: null,
        reset_token_expires: null
      })
      .eq('id', user.id);
    
    // Invalidate all sessions
    await supabase
      .from('sessions')
      .delete()
      .eq('user_id', user.id);
    
    res.json({ 
      message: 'Password reset successfully. Please log in with your new password.',
      success: true
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ 
      error: 'Failed to reset password',
      code: 'RESET_PASSWORD_FAILED'
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user (invalidate session)
 */
router.post('/logout', authenticate, async (req, res) => {
  try {
    const token = req.headers.authorization.substring(7);
    const tokenHash = hashToken(token);
    
    // Delete session
    await supabase
      .from('sessions')
      .delete()
      .eq('token_hash', tokenHash);
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      error: 'Logout failed',
      code: 'LOGOUT_FAILED'
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticate, async (req, res) => {
  res.json({
    user: formatUser(req.user)
  });
});

/**
 * GET /api/auth/account
 * Get current user profile plus storage usage
 */
router.get('/account', authenticate, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, full_name, email_verified, created_at, last_login')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const storage = await getStorageUsage(req.user.id);

    res.json({
      user: formatUser(user),
      storage
    });
  } catch (error) {
    console.error('Get account error:', error);
    res.status(500).json({
      error: 'Failed to fetch account details',
      code: 'ACCOUNT_FETCH_FAILED'
    });
  }
});

/**
 * PATCH /api/auth/account
 * Update editable account details
 */
router.patch('/account', authenticate, async (req, res) => {
  try {
    const { fullName } = req.body;
    const normalizedFullName = typeof fullName === 'string' ? fullName.trim() : null;

    const { data: user, error } = await supabase
      .from('users')
      .update({
        full_name: normalizedFullName || null
      })
      .eq('id', req.user.id)
      .select('id, email, full_name, email_verified, created_at, last_login')
      .single();

    if (error || !user) {
      return res.status(500).json({
        error: 'Failed to update account details',
        code: 'ACCOUNT_UPDATE_FAILED'
      });
    }

    const storage = await getStorageUsage(req.user.id);

    res.json({
      message: 'Account details updated successfully',
      user: formatUser(user),
      storage
    });
  } catch (error) {
    console.error('Update account error:', error);
    res.status(500).json({
      error: 'Failed to update account details',
      code: 'ACCOUNT_UPDATE_FAILED'
    });
  }
});

/**
 * DELETE /api/auth/account
 * Delete user account (requires authentication)
 */
router.delete('/account', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Delete all user sessions
    await supabase
      .from('sessions')
      .delete()
      .eq('user_id', userId);
    
    // Delete all user files from database (storage will be cleaned up by cascade)
    await supabase
      .from('files')
      .delete()
      .eq('user_id', userId);
    
    // Delete user account
    await supabase
      .from('users')
      .delete()
      .eq('id', userId);
    
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ 
      error: 'Failed to delete account',
      code: 'DELETE_ACCOUNT_FAILED'
    });
  }
});

console.log('✅ Authentication routes initialized');

export default router;

// Made with Bob
