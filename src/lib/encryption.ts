/**
 * Encryption utilities for BYOK API keys
 * Uses AES-256-GCM for secure key storage
 *
 * IMPORTANT: Requires ENCRYPTION_KEY environment variable
 * Generate with: openssl rand -hex 32
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;

/**
 * Get encryption key from environment
 * In production, this should be stored in a secure vault (AWS KMS, HashiCorp Vault, etc.)
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  if (key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }

  return Buffer.from(key, 'hex');
}

/**
 * Encrypt an API key for storage
 *
 * @param plaintext - The API key to encrypt
 * @returns Encrypted string in format: iv:authTag:salt:encrypted
 */
export function encryptAPIKey(plaintext: string): string {
  try {
    const key = getEncryptionKey();

    // Generate random IV (initialization vector)
    const iv = crypto.randomBytes(IV_LENGTH);

    // Generate random salt for additional security
    const salt = crypto.randomBytes(SALT_LENGTH);

    // Derive key using PBKDF2 with salt
    const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha256');

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);

    // Encrypt the plaintext
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Combine IV, auth tag, salt, and encrypted data
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${salt.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('[Encryption Error]', error);
    throw new Error('Failed to encrypt API key');
  }
}

/**
 * Decrypt an API key from storage
 *
 * @param encryptedData - The encrypted string from database
 * @returns Decrypted API key
 */
export function decryptAPIKey(encryptedData: string): string {
  try {
    const key = getEncryptionKey();

    // Split the encrypted data
    const parts = encryptedData.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted data format');
    }

    const [ivHex, authTagHex, saltHex, encrypted] = parts;

    // Convert from hex
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const salt = Buffer.from(saltHex, 'hex');

    // Derive key using same salt
    const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha256');

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('[Decryption Error]', error);
    throw new Error('Failed to decrypt API key');
  }
}

/**
 * Validate an API key format before encryption
 *
 * @param provider - AI provider name
 * @param apiKey - The API key to validate
 * @returns true if valid, throws error if invalid
 */
export function validateAPIKeyFormat(provider: string, apiKey: string): boolean {
  const patterns: Record<string, RegExp> = {
    anthropic: /^sk-ant-api03-[A-Za-z0-9_-]{95}$/,
    openai: /^sk-[A-Za-z0-9]{48}$/,
    google: /^AIza[A-Za-z0-9_-]{35}$/,
    moonshot: /^sk-[A-Za-z0-9]{32,}$/,
  };

  const pattern = patterns[provider];

  if (!pattern) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  if (!pattern.test(apiKey)) {
    throw new Error(`Invalid API key format for ${provider}`);
  }

  return true;
}

/**
 * Mask an API key for display (show only first/last few characters)
 *
 * @param apiKey - The API key to mask
 * @param visibleStart - Number of characters to show at start
 * @param visibleEnd - Number of characters to show at end
 * @returns Masked key like "sk-ant-api03-...xyz123"
 */
export function maskAPIKey(
  apiKey: string,
  visibleStart: number = 12,
  visibleEnd: number = 4
): string {
  if (apiKey.length <= visibleStart + visibleEnd) {
    return apiKey;
  }

  const start = apiKey.substring(0, visibleStart);
  const end = apiKey.substring(apiKey.length - visibleEnd);

  return `${start}...${end}`;
}

/**
 * Generate a random encryption key (for initial setup)
 * Run this once and store the result in ENCRYPTION_KEY env var
 *
 * @returns 64-character hex string (32 bytes)
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
