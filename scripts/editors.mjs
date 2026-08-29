/**
 * Inspect who is allowed to edit (/admin).
 *
 * Granting access is deliberately NOT possible from here — add editors in the
 * Supabase dashboard (Table Editor -> editors -> Insert row) so there is a
 * single place where access is granted. Use lowercase addresses: the login
 * check compares exactly.
 *
 *   npm run editors                      list
 *   npm run editors -- remove a@b.com    revoke (emergency lever)
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
  console.error(
    'Adding editors from the command line is disabled on purpose.\n' +
      'Add them in Supabase: Table Editor -> editors -> Insert row -> email (lowercase).'
  );
  process.exit(1);
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
  console.error(`Unknown action "${action}". Use: (nothing) | remove <email>`);
  process.exit(1);
}
