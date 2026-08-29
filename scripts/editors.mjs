/**
 * Manage who is allowed to edit (picks, pins, /admin).
 *
 * The `editors` table is the source of truth — EDITOR_EMAILS in .env.local only
 * seeds it the first time. RLS grants no write access to this table at all, so
 * it can only be changed with the secret key (here) or the Supabase dashboard.
 *
 *   npm run editors                      list
 *   npm run editors -- add a@b.com       allow
 *   npm run editors -- remove a@b.com    revoke
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

async function list() {
  const { data, error } = await db.from('editors').select('email, added_at').order('added_at');
  if (error) throw new Error(error.message);
  if (!data.length) {
    console.log('No editors yet. Nobody can write.');
    return;
  }
  console.log(`${data.length} editor(s):`);
  for (const e of data) console.log(`  ${e.email.padEnd(38)} added ${e.added_at.slice(0, 10)}`);
}

if (!action) {
  await list();
} else if (action === 'add') {
  if (!email?.includes('@')) {
    console.error('Usage: npm run editors -- add someone@example.com');
    process.exit(1);
  }
  const { error } = await db.from('editors').upsert({ email });
  if (error) throw new Error(error.message);
  console.log(`Allowed: ${email}`);
  console.log('They must sign in with this exact address for it to take effect.');
  await list();
} else if (action === 'remove') {
  if (!email) {
    console.error('Usage: npm run editors -- remove someone@example.com');
    process.exit(1);
  }
  const { error, count } = await db
    .from('editors')
    .delete({ count: 'exact' })
    .eq('email', email);
  if (error) throw new Error(error.message);
  console.log(count ? `Revoked: ${email}` : `Not found: ${email}`);
  await list();
} else {
  console.error(`Unknown action "${action}". Use: (nothing) | add <email> | remove <email>`);
  process.exit(1);
}
