import { NextResponse } from 'next/server';
import { admin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Daily Vercel Cron target. A trivial read keeps the Supabase free-tier project
 * from pausing after ~7 days of inactivity. Left outside the password gate in
 * middleware so the cron can reach it unauthenticated.
 */
export async function GET() {
  try {
    const { error } = await admin().from('itineraries').select('slug').limit(1);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, at: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown' },
      { status: 500 }
    );
  }
}
