'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { admin } from '@/lib/supabase/admin';
import { EDIT_COOKIE, verifySession } from '@/lib/auth';
import { SCHEMA, rowFromForm, type TableName } from '@/lib/schema';

/**
 * Every mutation re-checks the edit session server-side. Middleware gates the
 * page, but an action can be invoked directly, so it must not trust the caller.
 */
async function requireEditor(): Promise<string> {
  const jar = await cookies();
  const session = await verifySession<{ email: string }>(jar.get(EDIT_COOKIE)?.value);
  if (!session?.email) throw new Error('Your editing session has expired. Sign in again.');

  const { data } = await admin()
    .from('editors')
    .select('email')
    .eq('email', session.email)
    .maybeSingle();
  if (!data) throw new Error('This address is no longer allowed to edit.');
  return session.email;
}

function assertTable(name: string): TableName {
  if (!Object.prototype.hasOwnProperty.call(SCHEMA, name)) {
    throw new Error(`Unknown table "${name}".`);
  }
  return name as TableName;
}

function refresh(slug?: string | null) {
  revalidatePath('/');
  revalidatePath('/admin');
  if (slug) revalidatePath(`/admin/${slug}`);
}

export async function setPublished(id: string, published: boolean) {
  await requireEditor();
  const { error } = await admin().from('itineraries').update({ published }).eq('id', id);
  if (error) throw new Error(error.message);
  refresh();
}

/**
 * Insert or update one row of any editable table. The table and parent id come
 * from hidden inputs; both are validated against the schema before use.
 */
export async function saveRow(formData: FormData) {
  await requireEditor();

  const table = assertTable(String(formData.get('_table')));
  const id = String(formData.get('_id') ?? '');
  const slug = String(formData.get('_slug') ?? '') || null;
  const row = rowFromForm(table, formData);

  const parentKey = SCHEMA[table].parent;
  if (parentKey) {
    const parentId = String(formData.get('_parent') ?? '');
    if (!parentId) throw new Error(`Missing parent id for ${table}.`);
    row[parentKey] = parentId;
  }

  const db = admin();
  if (id) {
    const { error } = await db.from(table).update(row).eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    // New rows append to the end unless an explicit order was typed, so adding
    // ten days in a row does not leave them all at 0 in arbitrary order.
    if (!row.sort_order && parentKey) {
      const { data: last } = await db
        .from(table)
        .select('sort_order')
        .eq(parentKey, row[parentKey] as string)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();
      row.sort_order = (last?.sort_order ?? -1) + 1;
    }
    const { error } = await db.from(table).insert(row);
    if (error) throw new Error(error.message);
  }
  refresh(slug);
}

export async function deleteRow(formData: FormData) {
  await requireEditor();

  const table = assertTable(String(formData.get('_table')));
  const id = String(formData.get('_id') ?? '');
  const slug = String(formData.get('_slug') ?? '') || null;
  if (!id) throw new Error('Nothing to delete.');

  const { error } = await admin().from(table).delete().eq('id', id);
  if (error) throw new Error(error.message);
  refresh(slug);
}

/** Create a blank itinerary with one default variant, then open its editor. */
export async function createItinerary(formData: FormData) {
  await requireEditor();

  const name = String(formData.get('name') ?? '').trim();
  const slug = String(formData.get('slug') ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!name) throw new Error('Give the itinerary a name.');
  if (!slug) throw new Error('Give the itinerary a slug.');

  const db = admin();
  const { data: clash } = await db.from('itineraries').select('id').eq('slug', slug).maybeSingle();
  if (clash) throw new Error(`The slug "${slug}" is already used.`);

  const { data: maxRow } = await db
    .from('itineraries')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: created, error } = await db
    .from('itineraries')
    .insert({
      name,
      slug,
      icon: String(formData.get('icon') ?? '').trim() || '🧭',
      published: false, // hidden until you have filled it in
      sort_order: (maxRow?.sort_order ?? 0) + 1,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  // Every itinerary needs at least one variant to hang days/stays/legs from.
  const { error: vErr } = await db
    .from('variants')
    .insert({ itinerary_id: created.id, is_default: true, sort_order: 0 });
  if (vErr) throw new Error(vErr.message);

  refresh(slug);
  redirect(`/admin/${slug}`);
}

export async function deleteItinerary(formData: FormData) {
  await requireEditor();

  const slug = String(formData.get('slug') ?? '');
  const confirm = String(formData.get('confirm') ?? '').trim();
  if (confirm !== slug) {
    throw new Error(`Type the slug "${slug}" exactly to confirm deletion.`);
  }

  // Cascades through variants, stays, options, legs, days, places and notes.
  const { error } = await admin().from('itineraries').delete().eq('slug', slug);
  if (error) throw new Error(error.message);

  refresh();
  redirect('/admin');
}

/** Copy an itinerary and everything under it — the fast way to start next year. */
export async function duplicateItinerary(formData: FormData) {
  await requireEditor();
  const slug = String(formData.get('slug') ?? '');
  const db = admin();

  const { data: src, error } = await db
    .from('itineraries')
    .select('*, places(*), notes(*), variants(*, stays(*, stay_options(*)), legs(*), days(*))')
    .eq('slug', slug)
    .single();
  if (error) throw new Error(error.message);

  const newSlug = `${slug}_copy`.slice(0, 60);
  const { data: exists } = await db.from('itineraries').select('id').eq('slug', newSlug).maybeSingle();
  if (exists) throw new Error(`"${newSlug}" already exists — rename it first.`);

  const strip = <T extends Record<string, unknown>>(o: T, ...drop: string[]) => {
    const out: Record<string, unknown> = { ...o };
    for (const k of ['id', 'created_at', 'updated_at', ...drop]) delete out[k];
    return out;
  };

  const { places, notes, variants, ...itin } = src as Record<string, never> & {
    places: Record<string, unknown>[];
    notes: Record<string, unknown>[];
    variants: Record<string, unknown>[];
  };

  const { data: copy, error: cErr } = await db
    .from('itineraries')
    .insert({ ...strip(itin), slug: newSlug, name: `${src.name} (copy)`, published: false })
    .select()
    .single();
  if (cErr) throw new Error(cErr.message);

  for (const p of places ?? [])
    await db.from('places').insert({ ...strip(p, 'itinerary_id'), itinerary_id: copy.id });
  for (const n of notes ?? [])
    await db.from('notes').insert({ ...strip(n, 'itinerary_id'), itinerary_id: copy.id });

  for (const v of variants ?? []) {
    const { stays, legs, days, ...vrow } = v as {
      stays: Record<string, unknown>[];
      legs: Record<string, unknown>[];
      days: Record<string, unknown>[];
    };
    const { data: nv } = await db
      .from('variants')
      .insert({ ...strip(vrow, 'itinerary_id'), itinerary_id: copy.id })
      .select()
      .single();

    for (const l of legs ?? [])
      await db.from('legs').insert({ ...strip(l, 'variant_id'), variant_id: nv!.id });
    for (const d of days ?? [])
      await db.from('days').insert({ ...strip(d, 'variant_id'), variant_id: nv!.id });

    for (const s of stays ?? []) {
      const { stay_options, ...srow } = s as { stay_options: Record<string, unknown>[] };
      const { data: ns } = await db
        .from('stays')
        .insert({ ...strip(srow, 'variant_id'), variant_id: nv!.id })
        .select()
        .single();
      for (const o of stay_options ?? [])
        await db.from('stay_options').insert({ ...strip(o, 'stay_id'), stay_id: ns!.id });
    }
  }

  refresh();
  redirect(`/admin/${newSlug}`);
}
