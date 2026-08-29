/**
 * Inspect the Supabase Auth users behind editor sign-in.
 *
 * These are separate from the `editors` allowlist: `editors` decides WHO may
 * edit, Auth users are just how the code gets delivered and verified. The app
 * creates a confirmed Auth user automatically on first sign-in.
 *
 *   npm run auth-users                    list
 *   npm run auth-users -- reset a@b.com   delete, so the next code starts clean
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

const db = createClient(URL_, SECRET, { auth: { persistSession: false } });
const [action, rawEmail] = process.argv.slice(2);
const email = rawEmail?.trim().toLowerCase();

const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
if (error) {
  console.error(`Failed to list users: ${error.message}`);
  process.exit(1);
}
const users = data.users ?? [];

function list() {
  if (!users.length) {
    console.log('No Auth users yet. One is created the first time an editor signs in.');
    return;
  }
  console.log(`${users.length} auth user(s):`);
  for (const u of users) {
    const confirmed = u.email_confirmed_at ? 'confirmed' : 'UNCONFIRMED';
    const last = u.last_sign_in_at ? u.last_sign_in_at.slice(0, 10) : 'never';
    console.log(`  ${(u.email ?? '?').padEnd(34)} ${confirmed.padEnd(12)} last sign-in ${last}`);
  }
  const stuck = users.filter((u) => !u.email_confirmed_at);
  if (stuck.length) {
    console.log(
      `\n${stuck.length} unconfirmed — these came from the old signup flow and will ` +
        `keep getting the wrong email.\nClear with: npm run auth-users -- reset <email>`
    );
  }
}

if (!action) {
  list();
} else if (action === 'reset') {
  if (!email) {
    console.error('Usage: npm run auth-users -- reset someone@example.com');
    process.exit(1);
  }
  const user = users.find((u) => u.email?.toLowerCase() === email);
  if (!user) {
    console.log(`No auth user for ${email} — nothing to reset.`);
  } else {
    const { error: delErr } = await db.auth.admin.deleteUser(user.id);
    if (delErr) {
      console.error(`Failed: ${delErr.message}`);
      process.exit(1);
    }
    console.log(`Deleted auth user ${email}. The next sign-in recreates it, confirmed.`);
    console.log('This does NOT affect the editors allowlist.');
  }
} else {
  console.error(`Unknown action "${action}". Use: (nothing) | reset <email>`);
  process.exit(1);
}
