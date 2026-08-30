/** Full dump of one itinerary as JSON. Usage: npm run dump -- <slug> */
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
  .select('*, places(*), notes(*), variants(*, stays(*, stay_options(*)), legs(*), days(*))')
  .eq('slug', process.argv[2])
  .single();
if (error) { console.error(error.message); process.exit(1); }
console.log(JSON.stringify(data, null, 1));
