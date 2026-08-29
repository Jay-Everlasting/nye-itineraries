/** List the stays of one itinerary. Usage: npm run stays -- <slug> */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(join(ROOT, '.env.local')); } catch {}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const slug = process.argv[2];
const { data, error } = await db
  .from('itineraries')
  .select('slug, variants(id, label, stays(id,city,label,nights,sort_order, stay_options(id)))')
  .eq('slug', slug)
  .single();
if (error) { console.error(error.message); process.exit(1); }
for (const v of data.variants) {
  if (data.variants.length > 1) console.log(`window: ${v.label ?? '—'}`);
  for (const s of [...v.stays].sort((a, b) => a.sort_order - b.sort_order))
    console.log(
      `  order=${String(s.sort_order).padStart(2)}  ${s.city.padEnd(22)}` +
        ` options=${String(s.stay_options.length).padStart(2)}  label=${JSON.stringify(s.label)}`
    );
}
