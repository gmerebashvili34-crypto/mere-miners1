import crypto from 'crypto';

// AES-256-GCM helpers for encrypting private keys at rest
// Key source: ENCRYPTION_KEY (32 bytes when decoded from hex/base64 or derived via scrypt)

const ENC_ALGO = 'aes-256-gcm';
const IV_LEN = 12; // GCM recommended 12 bytes IV

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || '';
  if (!secret) throw new Error('ENCRYPTION_KEY not set');
  if (/^[0-9a-fA-F]{64}$/.test(secret)) {
    return Buffer.from(secret, 'hex');
  }
  if (/^[A-Za-z0-9+/=]+$/.test(secret)) {
    const buf = Buffer.from(secret, 'base64');
    if (buf.length === 32) return buf;
  }
  // Derive from UTF-8 passphrase via scrypt to 32 bytes
  return crypto.scryptSync(secret, 'mm-salt', 32);
}

export function encryptString(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ENC_ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

export function decryptString(payload: string): string {
  const key = getKey();
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + 16);
  const data = buf.subarray(IV_LEN + 16);
  const decipher = crypto.createDecipheriv(ENC_ALGO, key, iv);
  decipher.setAuthTag(tag);
  const out = Buffer.concat([decipher.update(data), decipher.final()]);
  return out.toString('utf8');
}
