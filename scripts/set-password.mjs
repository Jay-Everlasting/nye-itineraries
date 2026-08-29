/**
 * Set or rotate the shared read password.
 *
 *   npm run set-password -- 29082026
 *
 * Stored in the `settings` table as a PBKDF2-SHA256 hash with a random salt —
 * never as plain text. Must match lib/auth.ts, which verifies it.
 * Changing it immediately locks out everyone whose cookie has not yet expired?
 * No — existing 30-day cookies stay valid. See --revoke to force everyone out.
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
try {
  process.loadEnvFile(join(ROOT, '.env.local'));
} catch {
  /* handled below */
}

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
if (!URL_ || !SECRET) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY in .env.local');
  process.exit(1);
}

const ITERATIONS = 210_000;
const enc = new TextEncoder();

const b64url = (bytes) =>
  Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function hash(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    key,
    256
  );
  return { salt: b64url(salt), hash: b64url(new Uint8Array(bits)), iterations: ITERATIONS };
}

const password = process.argv[2];
if (!password) {
  console.error('Usage: npm run set-password -- <password>');
  process.exit(1);
}
if (password.length < 4) {
  console.error('Use at least 4 characters.');
  process.exit(1);
}
if (password.length < 8 || /^\d+$/.test(password)) {
  const space = /^\d+$/.test(password) ? 10 ** password.length : null;
  console.warn(
    `Note: short/numeric password${space ? ` (~${space.toLocaleString('en-US')} combinations)` : ''}.` +
      ' Guessable by an attacker who finds the URL.'
  );
}

const db = createClient(URL_, SECRET, { auth: { persistSession: false } });
const value = await hash(password);
const { error } = await db.from('settings').upsert({ key: 'read_password', value });
if (error) {
  console.error(`Failed: ${error.message}`);
  process.exit(1);
}

console.log('Read password set (stored hashed, never in plain text).');
console.log('Anyone already signed in keeps their 30-day session until it expires.');
console.log('To force everyone out immediately, rotate SESSION_SECRET in Vercel and redeploy.');
