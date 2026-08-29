import { notFound } from 'next/navigation';
import { admin } from '@/lib/supabase/admin';
import RowForm from '@/components/admin/RowForm';
import { deleteItinerary, duplicateItinerary } from '../actions';

export const dynamic = 'force-dynamic';

type Row = Record<string, unknown>;
const bySort = (a: Row, b: Row) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0);

/** Collapsed <details> keeps a long itinerary navigable. */
function Section({
  title,
  count,
  children,
  open = false,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
  open?: boolean;
}) {
  return (
    <details className="adm-section" open={open}>
      <summary>
        {title}
        {count !== undefined && <span className="adm-count">{count}</span>}
      </summary>
      <div className="adm-section-body">{children}</div>
    </details>
  );
}

export default async function EditItinerary({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const { data } = await admin()
    .from('itineraries')
    .select('*, places(*), notes(*), variants(*, stays(*, stay_options(*)), legs(*), days(*))')
    .eq('slug', slug)
    .maybeSingle();

  if (!data) notFound();

  const it = data as Row & {
    places: Row[];
    notes: Row[];
    variants: (Row & { stays: (Row & { stay_options: Row[] })[]; legs: Row[]; days: Row[] })[];
  };
  const variants = [...(it.variants ?? [])].sort(bySort);

  return (
    <div className="adm-wrap">
      <div className="adm-head">
        <a className="adm-back" href="/admin">
          ← All itineraries
        </a>
        <h1>
          {String(it.icon ?? '')} {String(it.name)}
        </h1>
        <div className="adm-sub">
          {it.published ? 'Visible on the site' : 'Hidden — not shown on the site'} ·{' '}
          <a href={`/?open=${slug}`} target="_blank" rel="noopener noreferrer">
            View ↗
          </a>
        </div>
      </div>

      <Section title="Itinerary details" open>
        <RowForm table="itineraries" row={it} slug={slug} />
      </Section>

      <Section title="Map places" count={it.places?.length ?? 0}>
        {[...(it.places ?? [])].sort(bySort).map((p) => (
          <RowForm key={String(p.id)} table="places" row={p} parentId={String(it.id)} slug={slug} />
        ))}
        <RowForm table="places" parentId={String(it.id)} slug={slug} title="New place" />
      </Section>

      <Section title="Notes & warnings" count={it.notes?.length ?? 0}>
        {[...(it.notes ?? [])].sort(bySort).map((n) => (
          <RowForm key={String(n.id)} table="notes" row={n} parentId={String(it.id)} slug={slug} />
        ))}
        <RowForm table="notes" parentId={String(it.id)} slug={slug} title="New note" />
      </Section>

      {variants.map((v, vi) => {
        const label = String(v.label ?? v.date_range ?? `Window ${vi + 1}`);
        const stays = [...(v.stays ?? [])].sort(bySort);
        return (
          <div className="adm-variant" key={String(v.id)}>
            <h2 className="adm-variant-title">
              {variants.length > 1 ? `Window: ${label}` : 'Trip contents'}
            </h2>

            <Section title="Window settings">
              <RowForm table="variants" row={v} parentId={String(it.id)} slug={slug} />
            </Section>

            <Section title="Days" count={v.days?.length ?? 0}>
              {[...(v.days ?? [])].sort(bySort).map((d) => (
                <RowForm key={String(d.id)} table="days" row={d} parentId={String(v.id)} slug={slug} />
              ))}
              <RowForm table="days" parentId={String(v.id)} slug={slug} title="New day" />
            </Section>

            <Section title="Travel legs" count={v.legs?.length ?? 0}>
              {[...(v.legs ?? [])].sort(bySort).map((l) => (
                <RowForm key={String(l.id)} table="legs" row={l} parentId={String(v.id)} slug={slug} />
              ))}
              <RowForm table="legs" parentId={String(v.id)} slug={slug} title="New leg" />
            </Section>

            <Section title="Stays & accommodation" count={stays.length}>
              {stays.map((s) => (
                <div className="adm-stay" key={String(s.id)}>
                  <RowForm table="stays" row={s} parentId={String(v.id)} slug={slug} />
                  <div className="adm-options">
                    <div className="adm-options-title">
                      Options for {String(s.city)} ({s.stay_options?.length ?? 0})
                    </div>
                    {[...(s.stay_options ?? [])].sort(bySort).map((o) => (
                      <RowForm
                        key={String(o.id)}
                        table="stay_options"
                        row={o}
                        parentId={String(s.id)}
                        slug={slug}
                      />
                    ))}
                    <RowForm
                      table="stay_options"
                      parentId={String(s.id)}
                      slug={slug}
                      title="New option"
                    />
                  </div>
                </div>
              ))}
              <RowForm table="stays" parentId={String(v.id)} slug={slug} title="New stay" />
            </Section>
          </div>
        );
      })}

      <Section title="Add another date window">
        <RowForm table="variants" parentId={String(it.id)} slug={slug} title="New window" />
      </Section>

      <hr className="div" />

      <Section title="Duplicate or delete">
        <form action={duplicateItinerary} className="adm-row">
          <input type="hidden" name="slug" value={slug} />
          <div className="adm-row-title">Duplicate</div>
          <p className="adm-help">
            Copies this itinerary and everything under it as <code>{slug}_copy</code>, hidden. The
            quickest way to start next year&rsquo;s trip from this one.
          </p>
          <div className="adm-actions">
            <button className="adm-btn" type="submit">
              Duplicate this itinerary
            </button>
          </div>
        </form>

        <form action={deleteItinerary} className="adm-row adm-danger">
          <input type="hidden" name="slug" value={slug} />
          <div className="adm-row-title">Delete permanently</div>
          <p className="adm-help">
            Removes the itinerary and every stay, option, day, leg, place and note under it. This
            cannot be undone. Type <code>{slug}</code> to confirm.
          </p>
          <div className="adm-grid">
            <label className="adm-field">
              <span className="adm-label">Confirm slug</span>
              <input type="text" name="confirm" placeholder={slug} autoComplete="off" />
            </label>
          </div>
          <div className="adm-actions">
            <button className="adm-btn danger" type="submit">
              Delete this itinerary
            </button>
          </div>
        </form>
      </Section>
    </div>
  );
}
