'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { admin } from '@/lib/supabase/admin';
import { EDIT_COOKIE, verifySession } from '@/lib/auth';

/**
 * Every mutation re-checks the edit session server-side. Middleware already
 * gates the page, but an action can be invoked directly, so it must not trust
 * that the caller came through the UI.
 */
async function requireEditor(): Promise<string> {
  const jar = await cookies();
  const session = await verifySession<{ email: string }>(jar.get(EDIT_COOKIE)?.value);
  if (!session?.email) throw new Error('Your editing session has expired. Sign in again.');

  // The allowlist may have changed since the session was issued.
  const { data } = await admin()
    .from('editors')
    .select('email')
    .eq('email', session.email)
    .maybeSingle();
  if (!data) throw new Error('This address is no longer allowed to edit.');
  return session.email;
}

export async function setPublished(id: string, published: boolean) {
  await requireEditor();
  const { error } = await admin().from('itineraries').update({ published }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/');
  revalidatePath('/admin');
}
