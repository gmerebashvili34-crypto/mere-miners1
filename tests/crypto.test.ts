import { describe, it, expect } from 'vitest';
import { encryptString, decryptString } from '../server/lib/crypto';

describe('crypto AES-256-GCM', () => {
  it('encrypts and decrypts roundtrip', () => {
    process.env.ENCRYPTION_KEY = 'test-secret-key-for-dev-only';
    const text = 'hello-world-private-key';
    const enc = encryptString(text);
    const dec = decryptString(enc);
    expect(dec).toBe(text);
  });
});
