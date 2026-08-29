/** Quick health check: what the server can actually see. */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(join(ROOT, '.env.local')); } catch {}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const { data, error } = await db.from('itineraries').select('slug, published').order('sort_order');
if (error) { console.error('ERROR:', error.message); process.exit(1); }
console.log('rows visible to the server:', data.length);
console.log('published                 :', data.filter(r => r.published).length);
const hidden = data.filter(r => !r.published).map(r => r.slug);
console.log('hidden                    :', hidden.length ? hidden.join(', ') : 'none');
