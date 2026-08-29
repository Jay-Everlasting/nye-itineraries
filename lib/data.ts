import { createClient } from '@supabase/supabase-js';
import type { Itinerary } from './types';

/**
 * Read-only client for server rendering. Uses the publishable key, so RLS
 * applies exactly as it does for any visitor — nothing privileged here.
 */
function readClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. ' +
        'Copy .env.example to .env.local (locally) or set them in Vercel project settings.'
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

const SELECT = `
  *,
  places(*),
  notes(*),
  variants(
    *,
    stays(*, stay_options(*)),
    legs(*),
    days(*)
  )
`;

const bySort = <T extends { sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order;

export async function getItineraries(): Promise<Itinerary[]> {
  const db = readClient();
  const { data, error } = await db
    .from('itineraries')
    .select(SELECT)
    .eq('published', true)
    .order('sort_order');

  if (error) throw new Error(`Failed to load itineraries: ${error.message}`);

  // PostgREST does not guarantee ordering of embedded rows, so sort here.
  const list = (data ?? []) as unknown as Itinerary[];
  for (const it of list) {
    it.places.sort(bySort);
    it.notes.sort(bySort);
    it.variants.sort(bySort);
    for (const v of it.variants) {
      v.legs.sort(bySort);
      v.days.sort(bySort);
      v.stays.sort(bySort);
      for (const s of v.stays) s.stay_options.sort(bySort);
    }
  }
  return list.sort(bySort);
}

export async function getAudRate(): Promise<number> {
  const db = readClient();
  const { data } = await db.from('settings').select('value').eq('key', 'aud_rate').maybeSingle();
  const v = Number(data?.value);
  return Number.isFinite(v) && v > 0 ? v : 1.63;
}
