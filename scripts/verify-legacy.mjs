/**
 * Recomputes each itinerary's headline totals from BOTH the legacy data and the
 * converted seed.json, and asserts they agree. Guards the migration against
 * silent money drift.
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'legacy/index.html'), 'utf8');
const dir = mkdtempSync(join(tmpdir(), 'nye-v-'));
const mod = join(dir, 'data.mjs');
writeFileSync(
  mod,
  html.slice(html.indexOf('const AUSTRIA_GT'), html.indexOf('function windowTotals')) +
    '\nexport { AUSTRIA_GT, AUSTRIA_CT, DATA };'
);
const { AUSTRIA_GT, AUSTRIA_CT, DATA } = await import(pathToFileURL(mod).href);
const GT_BY_ID = { austria: AUSTRIA_GT, austria_ct: AUSTRIA_CT };
const seed = JSON.parse(readFileSync(join(ROOT, 'scripts/seed.json'), 'utf8'));

const sum = (a, f) => a.reduce((s, x) => s + (f(x) || 0), 0);

/** Legacy: how the original index.html computed the headline number. */
function legacyTotals(it) {
  if (it.isGrandTour) {
    const gt = GT_BY_ID[it.id];
    // gtTravelTotal + gtAccomTotal (rank-1 pick per stay)
    const travel = sum(gt.travel, (t) => t.cost2);
    const accom = sum(gt.stays, (s) => (s.options.find((o) => o.rank === 1) || s.options[0]).total);
    return [{ travel, accom }];
  }
  if (it.isWindowPair) {
    // windowTotals(w): flight.costPerPerson*2 + selected hotel
    return it.windows.map((w) => ({
      travel: w.flight.costPerPerson * 2,
      accom: (w.hotels.find((h) => h.selected) || w.hotels[0]).total,
    }));
  }
  const travel = (it.flight?.costPerPerson || 0) * 2;
  const accom = it.accommodations
    ? sum(
        [...new Set(it.accommodations.map((a) => a.city))],
        (city) => {
          const list = it.accommodations.filter((a) => a.city === city);
          return (list.find((a) => a.selected) || list[0]).total;
        }
      )
    : it.price?.accom ?? sum(it.hotels || [], (h) => h.total);
  return [{ travel, accom }];
}

/** Unified: the same number derived from the new schema. */
function unifiedTotals(rec) {
  return rec.variants.map((v) => ({
    travel: sum(v.legs, (l) => Number(l.cost_total_eur)),
    accom: sum(v.stays, (s) => {
      const pick = s.options.find((o) => o.selected) || s.options[0];
      return pick ? Number(pick.total_eur) : 0;
    }),
  }));
}

let failures = 0;
console.log('itinerary      variant  travel EUR      accom EUR       total');
console.log('-'.repeat(70));

for (const it of DATA) {
  const rec = seed.itineraries.find((r) => r.slug === it.id);
  const L = legacyTotals(it);
  const U = unifiedTotals(rec);

  if (L.length !== U.length) {
    console.log(`  ${it.id}: VARIANT COUNT MISMATCH ${L.length} vs ${U.length}`);
    failures++;
    continue;
  }

  L.forEach((l, i) => {
    const u = U[i];
    const okT = Math.round(l.travel) === Math.round(u.travel);
    const okA = Math.round(l.accom) === Math.round(u.accom);
    if (!okT || !okA) failures++;
    const mark = okT && okA ? 'ok ' : 'XX ';
    const f = (a, b, ok) => (ok ? String(Math.round(a)).padStart(6) + '        ' : `${Math.round(a)}!=${Math.round(b)}`.padStart(14));
    console.log(
      `${mark}${it.id.padEnd(12)} ${String(i).padEnd(8)}${f(l.travel, u.travel, okT)}  ${f(l.accom, u.accom, okA)} ${String(Math.round(l.travel + l.accom)).padStart(7)}`
    );
  });
}

console.log('-'.repeat(70));
if (failures) {
  console.error(`\nFAIL: ${failures} mismatch(es) — the conversion loses or changes money.`);
  process.exit(1);
}
console.log('\nPASS: every itinerary total matches the legacy calculation.');
