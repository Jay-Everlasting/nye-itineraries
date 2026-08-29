import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The only Supabase client in the app. Uses the secret key, so it bypasses RLS
 * entirely — which is exactly why the browser never gets one. `server-only`
 * makes importing this from a client component a build error rather than a leak.
 */
let cached: SupabaseClient | null = null;

export function admin(): SupabaseClient {
  if (cached) return cached;

  // Trim: pasting into a dashboard field very often carries a trailing
  // newline or space, which Supabase rejects as 'Invalid API key'.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, '');
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY.\n' +
        'Locally: set them in .env.local.\n' +
        'On Vercel: Project Settings -> Environment Variables. SUPABASE_SECRET_KEY ' +
        'must NOT have a NEXT_PUBLIC_ prefix, or it would be sent to the browser.'
    );
  }
  if (secret.startsWith('sb_publishable_')) {
    throw new Error('SUPABASE_SECRET_KEY holds a publishable key. It must be the sb_secret_ one.');
  }
  if (!secret.startsWith('sb_secret_') && !secret.startsWith('eyJ')) {
    throw new Error(
      `SUPABASE_SECRET_KEY does not look like a key (starts "${secret.slice(0, 6)}", ` +
        `length ${secret.length}). Expected sb_secret_… — check for a truncated paste.`
    );
  }

  cached = createClient(url, secret, { auth: { persistSession: false } });
  return cached;
}
