import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Daily Vercel Cron target. A trivial read keeps the Supabase free-tier project
 * from pausing after ~7 days of inactivity.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ ok: false, error: 'missing env' }, { status: 500 });
  }
  const res = await fetch(`${url}/rest/v1/itineraries?select=slug&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  return NextResponse.json({ ok: res.ok, status: res.status, at: new Date().toISOString() });
}
