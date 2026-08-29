/**
 * Reads the original legacy/index.html, pulls the three data constants out of
 * its <script> block, and converts all four legacy shapes into the single
 * unified shape defined in supabase/migrations/0001_init.sql.
 *
 * Output: scripts/seed.json  (consumed by scripts/seed.mjs)
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'legacy/index.html'), 'utf8');

// The data constants sit between `const AUSTRIA_GT` and the first render fn.
const start = html.indexOf('const AUSTRIA_GT');
const end = html.indexOf('function windowTotals');
if (start < 0 || end < 0) throw new Error('Could not locate data block in legacy/index.html');

const dir = mkdtempSync(join(tmpdir(), 'nye-'));
const mod = join(dir, 'data.mjs');
writeFileSync(mod, html.slice(start, end) + '\nexport { AUSTRIA_GT, AUSTRIA_CT, DATA };');
const { AUSTRIA_GT, AUSTRIA_CT, DATA } = await import(pathToFileURL(mod).href);

const GT_BY_ID = { austria: AUSTRIA_GT, austria_ct: AUSTRIA_CT };

const clean = (v) => (v === undefined || v === '' ? null : v);

/** route[] + daytrips[] -> places[] */
function places(it) {
  const out = [];
  (it.route || []).forEach((p, i) =>
    out.push({
      kind: 'route', code: p.code, name: p.name, lat: p.lat ?? null, lng: p.lng ?? null,
      mode: clean(p.mode), tag: clean(p.tag), blurb: clean(p.blurb), from_code: null, sort_order: i,
    }));
  (it.daytrips || []).forEach((p, i) =>
    out.push({
      kind: 'daytrip', code: p.code, name: p.name, lat: p.lat ?? null, lng: p.lng ?? null,
      mode: clean(p.mode), tag: clean(p.tag), blurb: clean(p.blurb), from_code: clean(p.from),
      sort_order: (it.route || []).length + i,
    }));
  return out;
}

function days(list) {
  return (list || []).map((d, i) => ({
    day_no: d.d ?? i + 1,
    date_label: clean(d.date),
    title: d.title,
    // STANDARD/WINDOW use `desc`; GT uses `details`.
    description: clean(d.desc ?? d.details),
    tags: d.tags || [],
    sort_order: i,
  }));
}

/** flight{legs,costPerPerson} -> legs[]; per-person cost spread onto leg 1. */
function legsFromFlight(flight) {
  if (!flight) return [];
  const partyTotal = (flight.costPerPerson || 0) * 2;
  const list = flight.legs || [];
  if (!list.length) {
    // vie_tos has a flat estimate and no itemised legs.
    return partyTotal
      ? [{
          route: 'Flights (estimate)', mode: 'flight', carrier: null, date: null, dep: null,
          arr: null, times: null, cost_total_eur: partyTotal, note: clean(flight.altNote), sort_order: 0,
        }]
      : [];
  }
  return list.map((l, i) => ({
    route: l.route, mode: clean(l.mode) ?? 'flight', carrier: clean(l.carrier), date: clean(l.date),
    dep: clean(l.dep), arr: clean(l.arr), times: null,
    // The legacy price covers the whole flight set, not one leg: put it on the first.
    cost_total_eur: i === 0 ? partyTotal : null,
    note: clean(l.note), sort_order: i,
  }));
}

/** GT travel[] -> legs[] (already priced per leg, for 2 people) */
function legsFromTravel(travel) {
  return (travel || []).map((t, i) => ({
    route: t.leg, mode: clean(t.mode), carrier: clean(t.carrier), date: clean(t.date),
    dep: null, arr: null, times: clean(t.times),
    cost_total_eur: t.cost2 ?? null, note: clean(t.note), sort_order: i,
  }));
}

/**
 * STANDARD/WINDOW hotels[] -> stays[].
 *
 * Hotels sharing a date span are competing options for ONE stay; different
 * spans are sequential stays. That single rule covers both legacy meanings:
 * finland's Helsinki-then-Turku (two spans -> two stays) and tromso's
 * Window B alternatives (one span -> one stay, two options). Getting this
 * wrong double-counts accommodation, which is what verify-legacy.mjs checks.
 */
function staysFromHotels(hotels) {
  const groups = new Map();
  for (const h of hotels || []) {
    const key = h.checkin && h.checkout ? `${h.checkin}|${h.checkout}` : h.city || h.area || h.name;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(h);
  }
  return [...groups.values()].map((list, i) => {
    const h0 = list[0];
    return {
      city: h0.city || h0.area || 'Stay',
      label:
        h0.checkin && h0.checkout
          ? `${h0.checkin} – ${h0.checkout}${h0.nights ? ` (${h0.nights} nights)` : ''}`
          : null,
      checkin: clean(h0.checkin), checkout: clean(h0.checkout), nights: h0.nights ?? null,
      sort_order: i,
      options: list.map((h, j) => ({
        rank: j + 1, source: clean(h.source), name: h.name, total_eur: h.total ?? null,
        notes: clean(h.personalNote), extra_note: clean(h.extraNote), url: clean(h.url),
        address: clean(h.area), lat: null, lng: null,
        // Honour an explicit pick; otherwise the first entry is the pick.
        selected: list.some((x) => x.selected !== undefined) ? !!h.selected : j === 0,
        sort_order: j,
      })),
    };
  });
}

/** COMBO accommodations[] -> group by city, each city one stay with N options */
function staysFromAccommodations(accoms) {
  const byCity = new Map();
  for (const a of accoms || []) {
    if (!byCity.has(a.city)) byCity.set(a.city, []);
    byCity.get(a.city).push(a);
  }
  return [...byCity.entries()].map(([city, list], i) => ({
    city, label: null, checkin: null, checkout: null, nights: null, sort_order: i,
    options: list.map((a, j) => ({
      rank: j + 1, source: clean(a.source), name: a.name, total_eur: a.total ?? null,
      notes: clean(a.notes), extra_note: null, url: clean(a.url), address: clean(a.address),
      lat: null, lng: null, selected: !!a.selected, sort_order: j,
    })),
  }));
}

/** GT stays[] -> already the target shape */
function staysFromGt(gtStays) {
  return (gtStays || []).map((s, i) => ({
    city: s.city, label: clean(s.label), checkin: null, checkout: null, nights: null, sort_order: i,
    options: (s.options || []).map((o, j) => ({
      rank: o.rank ?? j + 1, source: clean(o.source), name: o.name, total_eur: o.total ?? null,
      notes: clean(o.notes), extra_note: null, url: clean(o.url),
      address: clean(o.geo), lat: null, lng: null,
      // Legacy GT kept the pick in localStorage only; default to the top rank.
      selected: (o.rank ?? j + 1) === 1, sort_order: j,
    })),
  }));
}

const out = { settings: [{ key: 'aud_rate', value: 1.63 }], itineraries: [] };

DATA.forEach((it, idx) => {
  const gt = it.isGrandTour ? GT_BY_ID[it.id] : null;

  let variants;
  if (it.isWindowPair) {
    // Two date windows -> two variants.
    variants = it.windows.map((w, i) => ({
      label: clean(w.label), date_range: clean(w.dateRange), day_dates: w.dayDates || null,
      flight_note: clean(w.flight?.altNote), sort_order: i, is_default: i === 0,
      stays: staysFromHotels(w.hotels), legs: legsFromFlight(w.flight),
      // Shared day list, re-dated per window.
      days: days(it.days).map((d, j) => ({ ...d, date_label: w.dayDates?.[j] ?? d.date_label })),
    }));
  } else {
    variants = [{
      label: null, date_range: clean(it.dates), day_dates: null,
      flight_note: clean(it.flight?.altNote), sort_order: 0, is_default: true,
      stays: gt
        ? staysFromGt(gt.stays)
        : it.accommodations
          ? staysFromAccommodations(it.accommodations)
          : staysFromHotels(it.hotels),
      legs: gt ? legsFromTravel(gt.travel) : legsFromFlight(it.flight),
      days: days(gt ? gt.days : it.days),
    }];
  }

  const notes = [];
  if (gt?.notincluded) notes.push({ kind: 'not_included', body: gt.notincluded, sort_order: 0 });
  (gt?.warnings || []).forEach((w, i) => notes.push({ kind: 'warning', body: w, sort_order: i + 1 }));

  out.itineraries.push({
    slug: it.id, icon: clean(it.icon), name: it.name, subtitle: clean(it.subtitle),
    countries: clean(it.countries), date_label: clean(it.dates), departure: clean(it.departure),
    note: clean(it.note), owner_note: clean(it.ownerNote), map_caption: clean(it.mapCap),
    flag: clean(it.flag), tags: it.tags || [], sort_order: idx, published: true,
    places: places(it), variants, notes,
  });
});

writeFileSync(join(ROOT, 'scripts/seed.json'), JSON.stringify(out, null, 2));

// ------------------------------------------------------------------ report
const n = (a, f) => a.reduce((s, x) => s + f(x), 0);
console.log('legacy -> unified\n');
for (const it of out.itineraries) {
  const stays = n(it.variants, (v) => v.stays.length);
  const opts = n(it.variants, (v) => n(v.stays, (s) => s.options.length));
  console.log(
    `  ${it.slug.padEnd(12)} variants=${it.variants.length}  places=${String(it.places.length).padEnd(2)}` +
      ` stays=${String(stays).padEnd(2)} options=${String(opts).padEnd(3)}` +
      ` legs=${String(n(it.variants, (v) => v.legs.length)).padEnd(2)}` +
      ` days=${String(n(it.variants, (v) => v.days.length)).padEnd(3)} notes=${it.notes.length}`
  );
}
console.log(
  `\n  totals: ${out.itineraries.length} itineraries, ` +
    `${n(out.itineraries, (i) => i.variants.length)} variants, ` +
    `${n(out.itineraries, (i) => n(i.variants, (v) => n(v.stays, (s) => s.options.length)))} stay options`
);
