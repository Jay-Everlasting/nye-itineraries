'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { admin } from '@/lib/supabase/admin';
import {
  READ_COOKIE,
  EDIT_COOKIE,
  READ_TTL_SECONDS,
  EDIT_TTL_SECONDS,
  signSession,
  checkPassword,
  type PasswordHash,
} from '@/lib/auth';

const cookieBase = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

/** Only allow relative paths, so ?next= cannot bounce anyone off-site. */
function safeNext(next: unknown): string {
  const s = typeof next === 'string' ? next : '';
  return s.startsWith('/') && !s.startsWith('//') ? s : '/';
}

// ------------------------------------------------------------ read gate

export async function submitReadPassword(_prev: unknown, formData: FormData) {
  const password = String(formData.get('password') ?? '');
  const next = safeNext(formData.get('next'));
  if (!password) return { error: 'Enter the password.' };

  const db = admin();
  const { data, error } = await db
    .from('settings')
    .select('value')
    .eq('key', 'read_password')
    .maybeSingle();

  if (error) return { error: 'Could not reach the database. Try again in a moment.' };
  if (!data) {
    return { error: 'No password is set yet. Run: npm run set-password -- <password>' };
  }

  // PBKDF2 at 210k iterations costs ~100ms per attempt, which throttles guessing.
  const ok = await checkPassword(password, data.value as PasswordHash);
  if (!ok) return { error: 'That password is not right.' };

  const jar = await cookies();
  jar.set(READ_COOKIE, await signSession({ kind: 'read' }, READ_TTL_SECONDS), {
    ...cookieBase,
    maxAge: READ_TTL_SECONDS,
  });
  redirect(next);
}

// ------------------------------------------------------------ edit gate

/** Auth calls use the publishable key — auth endpoints are not RLS-gated. */
function authClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function sendEditCode(_prev: unknown, formData: FormData) {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const next = safeNext(formData.get('next'));
  if (!email.includes('@')) return { error: 'Enter a valid email address.' };

  // The allowlist is the gate. Checked before any email is sent.
  const { data: editor } = await admin()
    .from('editors')
    .select('email')
    .eq('email', email)
    .maybeSingle();

  if (!editor) {
    // Deliberately vague: do not reveal who is on the allowlist.
    return { error: 'That address cannot edit this site.' };
  }

  const { error } = await authClient().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) {
    return { error: `Could not send the code: ${error.message}` };
  }
  return { sent: true, email, next };
}

export async function verifyEditCode(_prev: unknown, formData: FormData) {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const token = String(formData.get('token') ?? '').trim();
  const next = safeNext(formData.get('next'));
  if (!token) return { error: 'Enter the code from your email.', sent: true, email, next };

  // Re-check the allowlist: it may have changed since the code was sent.
  const { data: editor } = await admin()
    .from('editors')
    .select('email')
    .eq('email', email)
    .maybeSingle();
  if (!editor) return { error: 'That address cannot edit this site.' };

  const { error } = await authClient().auth.verifyOtp({ email, token, type: 'email' });
  if (error) {
    return { error: 'That code is wrong or has expired.', sent: true, email, next };
  }

  // Successful verification proves control of the address. From here we run our
  // own 6-hour session rather than Supabase's, so expiry is entirely ours.
  const jar = await cookies();
  jar.set(EDIT_COOKIE, await signSession({ kind: 'edit', email }, EDIT_TTL_SECONDS), {
    ...cookieBase,
    maxAge: EDIT_TTL_SECONDS,
  });
  // Editing implies reading.
  if (!jar.get(READ_COOKIE)) {
    jar.set(READ_COOKIE, await signSession({ kind: 'read' }, READ_TTL_SECONDS), {
      ...cookieBase,
      maxAge: READ_TTL_SECONDS,
    });
  }
  redirect(next.startsWith('/admin') ? next : '/admin');
}

export async function signOutEditor() {
  const jar = await cookies();
  jar.delete(EDIT_COOKIE);
  redirect('/');
}

export async function signOutAll() {
  const jar = await cookies();
  jar.delete(EDIT_COOKIE);
  jar.delete(READ_COOKIE);
  redirect('/login');
}
