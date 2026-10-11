import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from './util';

function key() {
  const k = Buffer.from(env('TOKEN_ENCRYPTION_KEY'), 'hex');
  if (k.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes).');
  return k;
}

/** AES-256-GCM, output: base64(iv | tag | ciphertext). */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
}

export function decrypt(blob: string): string {
  const raw = Buffer.from(blob, 'base64');
  const d = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
}

/** Signed, expiring OAuth state tying the Microsoft callback to a Supabase user. */
export function signState(userId: string, ttlSeconds = 600): string {
  const payload = `${userId}.${Math.floor(Date.now() / 1000) + ttlSeconds}.${randomBytes(8).toString('hex')}`;
  const sig = createHmac('sha256', key()).update(payload).digest('base64url');
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}

export function verifyState(state: string): string | null {
  try {
    const [uid, exp, nonce, sig] = Buffer.from(state, 'base64url').toString().split('.');
    const expect = createHmac('sha256', key()).update(`${uid}.${exp}.${nonce}`).digest('base64url');
    if (!sig || sig.length !== expect.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
    if (Number(exp) < Date.now() / 1000) return null;
    return uid;
  } catch {
    return null;
  }
}
