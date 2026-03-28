import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long. Please set it in .env file');
}

/**
 * Generate JWT token for user
 * @param {string} userId - User ID
 * @param {string} email - User email
 * @returns {string} JWT token
 */
export function generateToken(userId, email) {
  return jwt.sign(
    { userId, email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Verify JWT token
 * @param {string} token - JWT token to verify
 * @returns {object|null} Decoded token payload or null if invalid
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return null;
  }
}

/**
 * Generate random token for email verification/password reset
 * @returns {string} Random hex token
 */
export function generateRandomToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a 6-digit verification code for email verification
 * @returns {string} Six digit verification code
 */
export function generateVerificationCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Hash token for storage (prevents token theft if database is compromised)
 * @param {string} token - Token to hash
 * @returns {string} Hashed token
 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

console.log('✅ JWT utilities initialized');

// Made with Bob
