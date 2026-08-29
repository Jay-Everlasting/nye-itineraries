/** Print one itinerary and its contents. Usage: npm run inspect -- <slug> */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(join(ROOT, '.env.local')); } catch {}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const slug = process.argv[2];
if (!slug) { console.error('Usage: npm run inspect -- <slug>'); process.exit(1); }
const { data, error } = await db
  .from('itineraries')
  .select('slug,name,icon,published, places(name), notes(kind), variants(id,label,is_default, days(day_no,date_label,title,tags), legs(route), stays(city, stay_options(name,total_eur,selected)))')
  .eq('slug', slug)
  .maybeSingle();
if (error) { console.error(error.message); process.exit(1); }
console.log(JSON.stringify(data, null, 1));
