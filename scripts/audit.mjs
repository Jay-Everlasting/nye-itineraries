/** Health check: totals per itinerary plus anything that looks accidental. */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(join(ROOT, '.env.local')); } catch {}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const { data, error } = await db
  .from('itineraries')
  .select('slug,name,published, variants(id,label, stays(id,city,label, stay_options(id,name,total_eur,selected)), legs(id), days(id)))')
  .order('sort_order');
if (error) { console.error(error.message); process.exit(1); }

const problems = [];
for (const it of data) {
  const vs = it.variants ?? [];
  let stays = 0, opts = 0, accom = 0;
  for (const v of vs) {
    for (const s of v.stays ?? []) {
      stays++;
      const os = s.stay_options ?? [];
      opts += os.length;
      const pick = os.find((o) => o.selected) ?? os[0];
      accom += Number(pick?.total_eur || 0);
      if (!os.length) problems.push(`${it.slug}: stay "${s.city}" has NO options`);
      if (os.filter((o) => o.selected).length > 1)
        problems.push(`${it.slug}: stay "${s.city}" has ${os.filter((o) => o.selected).length} picks selected`);
      for (const o of os) {
        if (!o.name?.trim()) problems.push(`${it.slug}/${s.city}: an option has no name`);
        if (o.total_eur === null) problems.push(`${it.slug}/${s.city}: "${o.name}" has no price`);
      }
    }
    if (!(v.stays ?? []).length) problems.push(`${it.slug}: window "${v.label ?? '—'}" has no stays`);
  }
  console.log(
    `${it.slug.padEnd(12)} ${it.published ? 'live  ' : 'hidden'} ` +
      `${String(vs.length).padStart(2)}w ${String(stays).padStart(2)}stays ${String(opts).padStart(3)}opts  accom EUR ${accom}`
  );
}
console.log('');
if (problems.length) { console.log('POSSIBLE ISSUES:'); for (const p of problems) console.log('  - ' + p); }
else console.log('No structural problems found.');
