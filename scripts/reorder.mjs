/**
 * Move an itinerary to a position in the sidebar list.
 *
 *   npm run reorder -- austria_ct_inn 0     (0 = first)
 *
 * Renumbers everything 0..n afterwards so the ordering stays clean.
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(join(ROOT, '.env.local')); } catch {}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const [slug, posRaw] = process.argv.slice(2);
if (!slug) { console.error('Usage: npm run reorder -- <slug> [position]'); process.exit(1); }

const { data: all, error } = await db.from('itineraries').select('id,slug,name,sort_order').order('sort_order');
if (error) { console.error(error.message); process.exit(1); }

const moving = all.find((i) => i.slug === slug);
if (!moving) { console.error(`No itinerary "${slug}".`); process.exit(1); }

const pos = Math.max(0, Math.min(all.length - 1, Number(posRaw ?? 0)));
const rest = all.filter((i) => i.slug !== slug);
rest.splice(pos, 0, moving);

for (const [i, it] of rest.entries()) {
  if (it.sort_order === i) continue;
  const { error: e } = await db.from('itineraries').update({ sort_order: i }).eq('id', it.id);
  if (e) { console.error(`${it.slug}: ${e.message}`); process.exit(1); }
}

console.log('New order:');
for (const [i, it] of rest.entries()) console.log(`  ${String(i).padStart(2)}  ${it.name}`);
