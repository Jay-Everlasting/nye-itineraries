/** Prints a safe fingerprint of each env value so you can compare with Vercel
 *  without revealing the secret. */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(join(ROOT, '.env.local')); } catch {}

for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'SESSION_SECRET']) {
  const v = process.env[k];
  if (!v) { console.log(`${k.padEnd(38)} MISSING`); continue; }
  const clean = v.trim();
  const ws = clean.length !== v.length ? '  <-- has surrounding whitespace!' : '';
  const shown = k.startsWith('NEXT_PUBLIC_SUPABASE_URL') ? clean
    : `${clean.slice(0, 14)}…${clean.slice(-4)}`;
  console.log(`${k.padEnd(38)} len=${String(clean.length).padEnd(4)} ${shown}${ws}`);
}
