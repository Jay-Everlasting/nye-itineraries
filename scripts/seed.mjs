/**
 * Loads scripts/seed.json into Supabase.
 *
 * Uses the SECRET key, which bypasses RLS — that is why this runs only on your
 * machine and is never deployed. Run it after applying
 * supabase/migrations/0001_init.sql.
 *
 *   node scripts/extract-legacy.mjs && node scripts/seed.mjs
 *
 * Idempotent: re-running replaces each itinerary by slug. Safe to run repeatedly.
 * Pass --dry to validate credentials and connectivity without writing.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// Missing .env.local is not fatal here — the credential check below explains it.
try {
  process.loadEnvFile(join(ROOT, '.env.local'));
} catch {
  /* fall through to the guidance below */
}

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const DRY = process.argv.includes('--dry');

if (!URL_ || !SECRET) {
  console.error(
    'Missing credentials.\n' +
      '  Copy .env.example to .env.local and fill in NEXT_PUBLIC_SUPABASE_URL\n' +
      '  and SUPABASE_SECRET_KEY (Dashboard -> Project Settings -> API Keys).'
  );
  process.exit(1);
}
if (SECRET.startsWith('sb_publishable_')) {
  console.error('That is the publishable key. Seeding needs the SECRET key (sb_secret_...).');
  process.exit(1);
}

const db = createClient(URL_, SECRET, { auth: { persistSession: false } });

/** Insert rows, return them with ids. Throws loudly on failure. */
async function insert(table, rows) {
  if (!rows.length) return [];
  const { data, error } = await db.from(table).insert(rows).select();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

const seed = JSON.parse(readFileSync(join(ROOT, 'scripts/seed.json'), 'utf8'));

// ---------------------------------------------------------------- preflight
const { error: pingErr } = await db.from('itineraries').select('slug').limit(1);
if (pingErr) {
  console.error(
    `Cannot read the itineraries table: ${pingErr.message}\n` +
      '  Did you run supabase/migrations/0001_init.sql in the SQL Editor?'
  );
  process.exit(1);
}
console.log(`Connected to ${URL_}`);

if (DRY) {
  console.log(`Dry run OK. Would load ${seed.itineraries.length} itineraries.`);
  process.exit(0);
}

// ---------------------------------------------------------------- editors
const emails = (process.env.EDITOR_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
if (emails.length) {
  const { error } = await db.from('editors').upsert(emails.map((email) => ({ email })));
  if (error) throw new Error(`editors: ${error.message}`);
  console.log(`Editors allowlisted: ${emails.join(', ')}`);
}

// ---------------------------------------------------------------- settings
if (seed.settings?.length) {
  const { error } = await db.from('settings').upsert(seed.settings);
  if (error) throw new Error(`settings: ${error.message}`);
}

// ---------------------------------------------------------------- itineraries
for (const it of seed.itineraries) {
  // Replace by slug. ON DELETE CASCADE clears variants/places/notes beneath it.
  const { error: delErr } = await db.from('itineraries').delete().eq('slug', it.slug);
  if (delErr) throw new Error(`delete ${it.slug}: ${delErr.message}`);

  const { places, variants, notes, ...row } = it;
  const [saved] = await insert('itineraries', [row]);

  await insert(
    'places',
    places.map((p) => ({ ...p, itinerary_id: saved.id }))
  );
  await insert(
    'notes',
    notes.map((n) => ({ ...n, itinerary_id: saved.id }))
  );

  for (const v of variants) {
    const { stays, legs, days, ...vrow } = v;
    const [savedV] = await insert('variants', [{ ...vrow, itinerary_id: saved.id }]);

    await insert(
      'legs',
      legs.map((l) => ({ ...l, variant_id: savedV.id }))
    );
    await insert(
      'days',
      days.map((d) => ({ ...d, variant_id: savedV.id }))
    );

    for (const s of stays) {
      const { options, ...srow } = s;
      const [savedS] = await insert('stays', [{ ...srow, variant_id: savedV.id }]);
      await insert(
        'stay_options',
        options.map((o) => ({ ...o, stay_id: savedS.id }))
      );
    }
  }

  const opts = variants.reduce(
    (n, v) => n + v.stays.reduce((m, s) => m + s.options.length, 0),
    0
  );
  console.log(`  ${it.slug.padEnd(12)} ${variants.length} variant(s), ${opts} stay option(s)`);
}

console.log(`\nSeeded ${seed.itineraries.length} itineraries.`);
