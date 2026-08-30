'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Itinerary } from '@/lib/types';
import { TAG_LABEL, variantTotals, pickFor } from '@/lib/types';
import ItineraryView from './ItineraryView';
import { CurrencyContext, makeCurrency, type CurrencyCode } from './currency';

export default function Planner({
  itineraries,
  audRate,
}: {
  itineraries: Itinerary[];
  audRate: number;
}) {
  const [activeSlug, setActiveSlug] = useState(itineraries[0].slug);
  const [code, setCode] = useState<CurrencyCode>('EUR');
  // stay.id -> stay_option.id. Local overrides on top of the stored picks.
  const [picks, setPicks] = useState<Record<string, string>>({});
  // variant chosen per itinerary; defaults to the first.
  const [variantBySlug, setVariantBySlug] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('cur');
      if (saved === 'AUD' || saved === 'EUR') setCode(saved);
      const savedPicks = window.localStorage.getItem('picks');
      if (savedPicks) setPicks(JSON.parse(savedPicks));
    } catch {
      /* private mode, or storage disabled — defaults are fine */
    }

    // ?open=<slug> jumps straight to one trip — used by "View" in the admin
    // editor. Read here rather than via searchParams so the page stays static.
    try {
      const want = new URLSearchParams(window.location.search).get('open');
      if (want && itineraries.some((i) => i.slug === want)) setActiveSlug(want);
    } catch {
      /* no-op */
    }
  }, [itineraries]);

  const setCurrency = useCallback((next: CurrencyCode) => {
    setCode(next);
    try {
      window.localStorage.setItem('cur', next);
    } catch {
      /* ignore */
    }
  }, []);

  const choose = useCallback((stayId: string, optionId: string) => {
    setPicks((prev) => {
      const next = { ...prev, [stayId]: optionId };
      try {
        window.localStorage.setItem('picks', JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const currency = useMemo(() => makeCurrency(code, audRate), [code, audRate]);
  const active = itineraries.find((i) => i.slug === activeSlug) ?? itineraries[0];

  return (
    <CurrencyContext.Provider value={currency}>
      <div className="sidebar">
        <div className="side-head">
          <div className="side-title">Trip options</div>
          <div className="cur-toggle" role="group" aria-label="Currency">
            {(['EUR', 'AUD'] as const).map((c) => (
              <button
                key={c}
                className={`cur-btn${code === c ? ' on' : ''}`}
                aria-pressed={code === c}
                onClick={() => setCurrency(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* id is load-bearing: the <=820px rules turn #side-list into the
            horizontal, swipeable itinerary bar. */}
        <div id="side-list">
          {itineraries.map((it) => {
            const v =
              it.variants.find((x) => x.id === variantBySlug[it.slug]) ??
              it.variants.find((x) => x.is_default) ??
              it.variants[0];
            const t = v ? variantTotals(v, picks) : null;
            return (
              <div
                key={it.slug}
                className={`side-item${it.slug === activeSlug ? ' active' : ''}`}
                onClick={() => setActiveSlug(it.slug)}
              >
                <span className="side-icon">{it.icon}</span>
                <span>{it.name}</span>
                {t ? <span className="side-price">{currency.fmt(t.perPerson)}</span> : null}
              </div>
            );
          })}
        </div>

        {/* Sibling of .side-foot, not a child: the <=820px rules hide
            .side-foot entirely, which would take the link with it. */}
        <a className="side-admin" href="/admin" aria-label="Manage itineraries" title="Manage itineraries">
          <span className="side-admin-icon" aria-hidden="true">⚙️</span>
          <span className="side-admin-text">Manage</span>
        </a>

        <div className="side-foot">
          {itineraries.length} options · 2 travelers
          <br />
          Prices are per person unless noted.
        </div>
      </div>

      <div className="nav-hint">
        ← <b>Swipe the bar above</b> to see all the itineraries →
      </div>

      <div className="main">
        <div className="page active">
          <ItineraryView
            key={active.slug}
            itinerary={active}
            picks={picks}
            onChoose={choose}
            variantId={variantBySlug[active.slug]}
            onVariant={(id) => setVariantBySlug((p) => ({ ...p, [active.slug]: id }))}
          />
        </div>
      </div>
    </CurrencyContext.Provider>
  );
}

export { TAG_LABEL, pickFor };
