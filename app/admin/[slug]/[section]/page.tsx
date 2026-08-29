import { notFound } from 'next/navigation';
import { admin } from '@/lib/supabase/admin';
import RowForm from '@/components/admin/RowForm';
import OptionRow from '@/components/admin/OptionRow';
import DeleteButton from '@/components/admin/DeleteButton';
import { SECTIONS } from '@/lib/admin-sections';
import { deleteItinerary, duplicateItinerary } from '../../actions';

export const dynamic = 'force-dynamic';

type Row = Record<string, unknown>;
const bySort = (a: Row, b: Row) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0);
// Generic so sorting a variant list keeps its nested stays/legs/days types.
const sorted = <T extends Row>(rows: T[] | undefined): T[] => [...(rows ?? [])].sort(bySort);

export default async function SectionPage({
  params,
}: {
  params: Promise<{ slug: string; section: string }>;
}) {
  const { slug, section } = await params;
  if (!SECTIONS.some((s) => s.key === section)) notFound();

  const db = admin();
  const { data } = await db
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
  const variants = sorted(it.variants);
  const multi = variants.length > 1;

  /** Heading shown above each window's content, only when there is more than one. */
  const windowTitle = (v: Row, i: number) =>
    multi ? (
      <h2 className="adm-window">
        🪟 {String(v.label ?? v.date_range ?? `Window ${i + 1}`)}
      </h2>
    ) : null;

  // ------------------------------------------------------------ accommodation
  if (section === 'stays') {
    return (
      <>
        <p className="adm-intro">
          Each stay is one place you sleep. Under it are the options you are choosing between — tick
          the one you have picked and every total updates.
        </p>

        {variants.map((v, vi) => (
          <div key={String(v.id)}>
            {windowTitle(v, vi)}

            {sorted(v.stays).map((stay) => {
              const options = sorted((stay as { stay_options: Row[] }).stay_options);
              return (
                <section className="adm-card" key={String(stay.id)}>
                  <header className="adm-card-head">
                    <h3>{String(stay.city)}</h3>
                    <span className="adm-card-meta">
                      {String(stay.label ?? '')} · {options.length}{' '}
                      {options.length === 1 ? 'option' : 'options'}
                    </span>
                  </header>

                  <div className="opt-head">
                    <span className="opt-pick">Pick</span>
                    <span className="opt-rank">#</span>
                    <span className="opt-name">Property</span>
                    <span className="opt-source">Source</span>
                    <span className="opt-price-wrap">Total</span>
                    <span className="opt-url">Link</span>
                    <span />
                  </div>

                  {options.map((o) => (
                    <OptionRow key={String(o.id)} option={o} stayId={String(stay.id)} slug={slug} />
                  ))}
                  <OptionRow stayId={String(stay.id)} slug={slug} isNew city={String(stay.city)} />

                  <details className="adm-stay-settings">
                    <summary>Stay settings (city, dates, nights)</summary>
                    <RowForm table="stays" row={stay} parentId={String(v.id)} slug={slug} />
                  </details>
                </section>
              );
            })}

            <details className="adm-section adm-add-city">
              <summary>🏙️ Add a new city or base</summary>
              <div className="adm-section-body">
                <p className="adm-help">
                  Only for a <b>new place you sleep</b> — another city, or a cabin leg. To add
                  another hotel or apartment to a city that is already listed, use the
                  &ldquo;Add another place to stay&rdquo; row inside that city&rsquo;s card above.
                </p>
                <RowForm table="stays" parentId={String(v.id)} slug={slug} title="New city or base" />
              </div>
            </details>
          </div>
        ))}
      </>
    );
  }

  // ------------------------------------------------------------ simple lists
  const lists = {
    days: { table: 'days' as const, parent: 'variant', title: 'Day', intro: 'The day-by-day plan.' },
    travel: {
      table: 'legs' as const,
      parent: 'variant',
      title: 'Leg',
      intro: 'Flights, trains and cars. Prices are the total for 2 people.',
    },
    map: {
      table: 'places' as const,
      parent: 'itinerary',
      title: 'Place',
      intro: 'Pins on the route map. Use kind "daytrip" plus a "from" code for side trips.',
    },
  };

  if (section in lists) {
    const cfg = lists[section as keyof typeof lists];
    if (cfg.parent === 'itinerary') {
      const rows = sorted(it[cfg.table] as Row[]);
      return (
        <>
          <p className="adm-intro">{cfg.intro}</p>
          {rows.map((r) => (
            <RowForm
              key={String(r.id)}
              table={cfg.table}
              row={r}
              parentId={String(it.id)}
              slug={slug}
            />
          ))}
          <RowForm
            table={cfg.table}
            parentId={String(it.id)}
            slug={slug}
            title={`New ${cfg.title.toLowerCase()}`}
          />
        </>
      );
    }
    return (
      <>
        <p className="adm-intro">{cfg.intro}</p>
        {variants.map((v, vi) => (
          <div key={String(v.id)}>
            {windowTitle(v, vi)}
            {sorted(v[cfg.table] as Row[]).map((r) => (
              <RowForm
                key={String(r.id)}
                table={cfg.table}
                row={r}
                parentId={String(v.id)}
                slug={slug}
              />
            ))}
            <RowForm
              table={cfg.table}
              parentId={String(v.id)}
              slug={slug}
              title={`New ${cfg.title.toLowerCase()}`}
            />
          </div>
        ))}
      </>
    );
  }

  // ------------------------------------------------------------ details
  if (section === 'details') {
    return (
      <>
        <p className="adm-intro">Everything shown at the top of the trip page, plus its notes.</p>
        <section className="adm-card">
          <header className="adm-card-head">
            <h3>Itinerary details</h3>
          </header>
          <RowForm table="itineraries" row={it} slug={slug} />
        </section>

        <section className="adm-card">
          <header className="adm-card-head">
            <h3>Notes &amp; warnings</h3>
            <span className="adm-card-meta">{it.notes?.length ?? 0}</span>
          </header>
          {sorted(it.notes).map((n) => (
            <RowForm key={String(n.id)} table="notes" row={n} parentId={String(it.id)} slug={slug} />
          ))}
          <RowForm table="notes" parentId={String(it.id)} slug={slug} title="New note" />
        </section>

        <section className="adm-card">
          <header className="adm-card-head">
            <h3>Date windows</h3>
            <span className="adm-card-meta">
              {variants.length} — most trips need only one
            </span>
          </header>
          {variants.map((v) => (
            <RowForm
              key={String(v.id)}
              table="variants"
              row={v}
              parentId={String(it.id)}
              slug={slug}
            />
          ))}
          <RowForm table="variants" parentId={String(it.id)} slug={slug} title="New window" />
        </section>
      </>
    );
  }

  // ------------------------------------------------------------ manage
  return (
    <>
      <p className="adm-intro">Copy this trip to start a new one, or remove it for good.</p>

      <section className="adm-card">
        <header className="adm-card-head">
          <h3>Duplicate</h3>
        </header>
        <form action={duplicateItinerary} className="adm-row">
          <input type="hidden" name="slug" value={slug} />
          <p className="adm-help">
            Copies this itinerary and everything under it as <code>{slug}_copy</code>, hidden. The
            quickest way to start next year from this one.
          </p>
          <div className="adm-actions">
            <button className="adm-btn" type="submit">
              Duplicate this itinerary
            </button>
          </div>
        </form>
      </section>

      <section className="adm-card">
        <header className="adm-card-head">
          <h3>Delete permanently</h3>
        </header>
        <form action={deleteItinerary} className="adm-row adm-danger">
          <input type="hidden" name="slug" value={slug} />
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
            <DeleteButton
              action={deleteItinerary}
              label="Delete this itinerary"
              confirmText={`Permanently delete "${String(it.name)}" and everything in it?`}
            />
          </div>
        </form>
      </section>
    </>
  );
}
