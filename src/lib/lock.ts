// Device-level app lock: a 4-digit passcode, plus Face ID / Touch ID through WebAuthn
// where the device supports a platform authenticator. Stored on this device only.

const KEY = 'htl.lock';

interface LockConfig {
  pinHash: string;
  credId?: string; // base64url WebAuthn credential id
}

async function sha(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`htl:${s}`));
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

const b64u = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

function read(): LockConfig | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LockConfig) : null;
  } catch {
    return null;
  }
}

export const lockEnabled = () => read() !== null;
export const biometricEnrolled = () => Boolean(read()?.credId);

export async function setPin(pin: string) {
  const cur = read();
  localStorage.setItem(KEY, JSON.stringify({ ...cur, pinHash: await sha(pin) }));
}

export function disableLock() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export async function checkPin(pin: string) {
  const cur = read();
  return Boolean(cur && cur.pinHash === (await sha(pin)));
}

export async function biometricAvailable() {
  return Boolean(window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.()));
}

export async function enrollBiometric(label: string) {
  const cur = read();
  if (!cur) throw new Error('Set a passcode first');
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Hold the Line', id: location.hostname },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: label, displayName: label },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error('Face ID setup was cancelled');
  localStorage.setItem(KEY, JSON.stringify({ ...cur, credId: b64u(cred.rawId) }));
}

export async function unlockWithBiometric(): Promise<boolean> {
  const cur = read();
  if (!cur?.credId) return false;
  try {
    const res = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id: fromB64u(cur.credId) }],
        userVerification: 'required',
        timeout: 60_000,
      },
    });
    return Boolean(res);
  } catch {
    return false;
  }
}
