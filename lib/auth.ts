/**
 * Session cookies and password hashing.
 *
 * Uses Web Crypto only (no node:crypto), so the exact same code runs in
 * middleware on the Edge runtime and in server actions on Node.
 *
 * Two independent sessions:
 *   nye_read  — knows the shared password.        30 days.
 *   nye_edit  — proved control of an allowlisted  6 hours.
 *               email via a one-time code.
 */

export const READ_COOKIE = 'nye_read';
export const EDIT_COOKIE = 'nye_edit';

export const READ_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
export const EDIT_TTL_SECONDS = 6 * 60 * 60; // 6 hours

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64url(s: string): Uint8Array {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function sessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      'SESSION_SECRET is missing or too short. Generate one with:\n' +
        "  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return s;
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(sessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/** Constant-time comparison. */
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Sign a payload into a cookie value: <base64url(json)>.<base64url(hmac)>.
 * The expiry lives inside the signed payload, so a tampered or copied cookie
 * cannot outlive its window.
 */
export async function signSession(data: Record<string, unknown>, ttlSeconds: number) {
  const payload = { ...data, exp: Date.now() + ttlSeconds * 1000 };
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(), enc.encode(body));
  return `${body}.${b64url(new Uint8Array(sig))}`;
}

export async function verifySession<T = Record<string, unknown>>(
  value: string | undefined
): Promise<T | null> {
  if (!value) return null;
  const [body, sig] = value.split('.');
  if (!body || !sig) return null;

  let ok = false;
  try {
    const expected = await crypto.subtle.sign('HMAC', await hmacKey(), enc.encode(body));
    ok = sameBytes(new Uint8Array(expected), unb64url(sig));
  } catch {
    return null;
  }
  if (!ok) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(unb64url(body)));
    if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return null;
    return payload as T;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------ password hash

const PBKDF2_ITERATIONS = 210_000;

async function pbkdf2(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    key,
    256
  );
  return new Uint8Array(bits);
}

export type PasswordHash = { salt: string; hash: string; iterations: number };

export async function hashPassword(password: string): Promise<PasswordHash> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return { salt: b64url(salt), hash: b64url(hash), iterations: PBKDF2_ITERATIONS };
}

export async function checkPassword(password: string, stored: PasswordHash): Promise<boolean> {
  if (!stored?.salt || !stored?.hash) return false;
  const hash = await pbkdf2(password, unb64url(stored.salt), stored.iterations || PBKDF2_ITERATIONS);
  return sameBytes(hash, unb64url(stored.hash));
}
