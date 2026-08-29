'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import type { Itinerary } from '@/lib/types';
import { TAG_LABEL, variantTotals, pickFor } from '@/lib/types';
import { Money } from './currency';

const TripMap = dynamic(() => import('./TripMap'), {
  ssr: false,
  loading: () => <div className="mapbox" />,
});

const modeIcon = (mode: string | null) =>
  mode === 'train' ? '🚆' : mode === 'car' ? '🚗' : mode === 'ferry' ? '⛴️' : '✈️';

export default function ItineraryView({
  itinerary: it,
  picks,
  onChoose,
  variantId,
  onVariant,
}: {
  itinerary: Itinerary;
  picks: Record<string, string>;
  onChoose: (stayId: string, optionId: string) => void;
  variantId?: string;
  onVariant: (id: string) => void;
}) {
  const variant =
    it.variants.find((v) => v.id === variantId) ??
    it.variants.find((v) => v.is_default) ??
    it.variants[0];

  const totals = useMemo(() => variantTotals(variant, picks), [variant, picks]);
  const nights = variant.stays.reduce((s, x) => s + (x.nights || 0), 0);
  const notIncluded = it.notes.filter((n) => n.kind === 'not_included');
  const warnings = it.notes.filter((n) => n.kind === 'warning');
  const hasChoices = variant.stays.some((s) => s.stay_options.length > 1);

  return (
    <div className="page-inner">
      <div className="page-icon">{it.icon}</div>
      <h1>{it.name}</h1>
      <div className="page-sub">{it.subtitle}</div>

      <div className="props">
        {it.countries && (
          <div className="prow">
            <div className="plabel">📍 Countries</div>
            <div className="pvalue">{it.countries}</div>
          </div>
        )}
        <div className="prow">
          <div className="plabel">📅 Dates</div>
          <div className="pvalue">{variant.date_range || it.date_label}</div>
        </div>
        <div className="prow">
          <div className="plabel">✈️ Departure</div>
          <div className="pvalue">{it.departure || 'Amsterdam (AMS)'}</div>
        </div>
        <div className="prow">
          <div className="plabel">💶 Per person</div>
          <div className="pvalue strong">
            <Money eur={totals.perPerson} />
          </div>
        </div>
      </div>

      <div className="pills">
        {it.tags.map((t) => (
          <span key={t} className={`pill ${t}`}>
            {TAG_LABEL[t] ?? t}
          </span>
        ))}
      </div>

      {it.flag && <div className="callout flag">⚠️ {it.flag}</div>}

      {/* Only shown when a trip has more than one date window researched. */}
      {it.variants.length > 1 && (
        <>
          <hr className="div" />
          <h2 className="sec">🪟 Date windows</h2>
          <div className="cur-toggle" role="group" aria-label="Date window">
            {it.variants.map((v) => (
              <button
                key={v.id}
                className={`cur-btn${v.id === variant.id ? ' on' : ''}`}
                aria-pressed={v.id === variant.id}
                onClick={() => onVariant(v.id)}
              >
                {v.label || v.date_range}
              </button>
            ))}
          </div>
          <div className="callout">
            Both windows were researched — switching changes the flights, stays and every total
            below.
          </div>
        </>
      )}

      {it.places.length > 0 && (
        <>
          <hr className="div" />
          <h2 className="sec">🗺️ The route</h2>
          <TripMap itinerary={it} variant={variant} picks={picks} />
          <div className="map-cap">
            {it.map_caption || 'Drag to pan, scroll to zoom, click a stop for details.'}
          </div>
        </>
      )}

      {variant.days.length > 0 && (
        <>
          <h2 className="sec">📅 Day by day</h2>
          {variant.days.map((d) => (
            <details className="day" key={d.id} open>
              <summary>
                <span className="day-badge">{String(d.day_no ?? 0).padStart(2, '0')}</span>
                <span className="day-date">{d.date_label}</span>
                <span className="day-title">{d.title}</span>
              </summary>
              <div className="day-content">
                {d.description}
                {d.tags.length > 0 && (
                  <div className="day-tag">
                    {d.tags.map((t) => (
                      <span key={t} className={`pill ${t}`}>
                        {TAG_LABEL[t] ?? t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </details>
          ))}
        </>
      )}

      {variant.stays.length > 0 && (
        <>
          <hr className="div" />
          <h2 className="sec">🏨 Accommodation{hasChoices ? ' — pick one per stop' : ''}</h2>
          {hasChoices && (
            <div className="callout" style={{ marginBottom: 16 }}>
              In preference order (#1 = most preferred). Tap an option to select it — every total
              updates instantly.
            </div>
          )}
          {variant.stays.map((stay) => {
            const chosen = pickFor(stay, picks);
            return (
              <div className="gt-stay" key={stay.id}>
                <div className="gt-stay-head">
                  <span className="gt-stay-city">{stay.city}</span>
                  <span className="gt-stay-dates">{stay.label}</span>
                  <span className="gt-stay-count">
                    {stay.stay_options.length}{' '}
                    {stay.stay_options.length === 1 ? 'option' : 'options'}
                  </span>
                </div>
                {stay.stay_options.map((o) => (
                  <div
                    key={o.id}
                    className={`gt-opt${chosen?.id === o.id ? ' chosen' : ''}`}
                    onClick={() => onChoose(stay.id, o.id)}
                  >
                    <div className="gt-radio" />
                    <div className="gt-rank">{o.rank}</div>
                    <div className="gt-body">
                      <div className="gt-line1">
                        {o.source && (
                          <span className="pill src" style={{ padding: '2px 8px', fontSize: 10 }}>
                            {o.source}
                          </span>
                        )}
                        <span className="gt-name">{o.name}</span>
                      </div>
                      {o.notes && <div className="gt-note">&ldquo;{o.notes}&rdquo;</div>}
                      {o.extra_note && <div className="gt-note">{o.extra_note}</div>}
                      {o.url && (
                        <div className="gt-actions" onClick={(e) => e.stopPropagation()}>
                          <a className="gt-btn" href={o.url} target="_blank" rel="noopener noreferrer">
                            Open listing ↗
                          </a>
                        </div>
                      )}
                    </div>
                    <div className="gt-price">
                      <Money eur={o.total_eur} />
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </>
      )}

      {variant.legs.length > 0 && (
        <>
          <hr className="div" />
          <h2 className="sec">🚆 Getting there &amp; around</h2>
          {variant.legs.map((l) => (
            <div className="gt-leg" key={l.id}>
              <div className="gt-leg-icon">{modeIcon(l.mode)}</div>
              <div className="gt-leg-body">
                <div className="gt-leg-route">{l.route}</div>
                <div className="gt-leg-meta">
                  {[l.carrier, l.date, l.times || (l.dep && l.arr ? `${l.dep}–${l.arr}` : null)]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
                {l.note && <div className="gt-leg-note">{l.note}</div>}
              </div>
              <div className="gt-leg-cost">
                {l.cost_total_eur ? <Money eur={l.cost_total_eur} /> : ''}
              </div>
            </div>
          ))}
          <div className="callout">
            Travel prices are the <b>total for 2 people</b>.
          </div>
          {variant.flight_note && <div className="callout">{variant.flight_note}</div>}
        </>
      )}

      <hr className="div" />
      <h2 className="sec">💰 The numbers — travel + accommodation</h2>
      <div className="gt-total-card">
        <div className="gt-total-row">
          <span>Travel, 2 travelers</span>
          <span className="v">
            <Money eur={totals.travel} />
          </span>
        </div>
        <div className="gt-total-row">
          <span>Accommodation{nights ? ` (${nights} nights)` : ''}</span>
          <span className="v">
            <Money eur={totals.accom} />
          </span>
        </div>
        <div className="gt-total-row sum">
          <span>Total, 2 travelers</span>
          <span className="v">
            <Money eur={totals.total} />
          </span>
        </div>
      </div>
      <div className="total-callout">
        <span className="label">Per person</span>
        <span className="val">
          <Money eur={totals.perPerson} />
        </span>
      </div>

      {notIncluded.map((n) => (
        <div className="callout" key={n.id}>
          {n.body}
        </div>
      ))}
      {warnings.map((n) => (
        <div className="callout" key={n.id} style={{ borderLeft: '3px solid #e8c98a' }}>
          ⚠️ {n.body}
        </div>
      ))}
      {it.note && <div className="callout">{it.note}</div>}
      {it.owner_note && <div className="callout">{it.owner_note}</div>}
    </div>
  );
}
