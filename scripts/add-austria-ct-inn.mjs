/**
 * Creates "Austria (Compact + Innsbruck)" — the Compact Tour with the Salzburg
 * exit swapped for three nights of skiing in Innsbruck.
 *
 *   npm run add:ct-inn
 *
 * Idempotent: deletes any existing `austria_ct_inn` first, so re-running gives
 * the same result. Cabin options and days 1-6 are copied from `austria_ct` in
 * the database rather than retyped, so they cannot drift.
 *
 * Created hidden (published: false) — review it in /admin, then flip Visible.
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
try {
  process.loadEnvFile(join(ROOT, '.env.local'));
} catch {
  /* checked below */
}

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
if (!URL_ || !SECRET) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY in .env.local');
  process.exit(1);
}
const db = createClient(URL_, SECRET, { auth: { persistSession: false } });

const SLUG = 'austria_ct_inn';
const SOURCE = 'austria_ct';

const ins = async (table, rows) => {
  if (!rows.length) return [];
  const { data, error } = await db.from(table).insert(rows).select();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
};

// ---------------------------------------------------------------- source trip
const { data: src, error: srcErr } = await db
  .from('itineraries')
  .select('*, notes(*), variants(*, stays(*, stay_options(*)), days(*)))')
  .eq('slug', SOURCE)
  .single();
if (srcErr) throw new Error(`Could not read ${SOURCE}: ${srcErr.message}`);

const srcVariant = src.variants[0];
const srcCabin = srcVariant.stays.find((s) => /cabin/i.test(s.city));
if (!srcCabin) throw new Error('Could not find the cabin stay on the Compact Tour.');
const srcDays = [...srcVariant.days].sort((a, b) => a.sort_order - b.sort_order);

// ---------------------------------------------------------------- replace
await db.from('itineraries').delete().eq('slug', SLUG);

const { data: maxRow } = await db
  .from('itineraries')
  .select('sort_order')
  .order('sort_order', { ascending: false })
  .limit(1)
  .maybeSingle();

const [itin] = await ins('itineraries', [
  {
    slug: SLUG,
    icon: '🎿',
    name: 'Austria (Compact + Innsbruck)',
    subtitle: 'Vienna (NYE) → mountain cabin → Innsbruck skiing',
    countries: 'Austria',
    date_label: 'Dec 29 – Jan 7 · 10 days, 9 nights',
    departure: 'Amsterdam (AMS) → Vienna · home from Innsbruck (INN)',
    tags: ['snow', 'nye'],
    published: false,
    sort_order: (maxRow?.sort_order ?? 0) + 1,
    map_caption:
      'Vienna → Salzburg → the cabin → Innsbruck, plus day trips from the cabin. ' +
      'Flights in and out are not drawn. Options without coordinates do not appear.',
    note:
      'The Compact Tour with the Salzburg exit swapped for three nights in Innsbruck and two ' +
      'days on the snow. Same Vienna and cabin legs; you drop the car at Salzburg airport and ' +
      'take the train west instead of flying home from there.',
  },
]);

// ---------------------------------------------------------------- places
await ins(
  'places',
  [
    { kind: 'route', code: 'VIE', name: 'Vienna', lat: 48.2087, lng: 16.3738, mode: null, tag: 'nye', blurb: '3 nights · New Year’s Eve here', sort_order: 0 },
    { kind: 'route', code: 'SZG', name: 'Salzburg', lat: 47.8095, lng: 13.055, mode: '🚆 train · 2h22', tag: null, blurb: 'Transit only — collect the car here', sort_order: 1 },
    { kind: 'route', code: 'CAB', name: 'Cabin (Salzkammergut)', lat: 47.6863, lng: 13.136, mode: '🚗 rental car · ~1h', tag: 'snow', blurb: '3 nights · sauna, Hallstatt', sort_order: 2 },
    { kind: 'route', code: 'INN', name: 'Innsbruck', lat: 47.2692, lng: 11.4041, mode: '🚆 train · from Salzburg', tag: 'snow', blurb: '3 nights · skiing in the Nordkette', sort_order: 3 },
    { kind: 'daytrip', code: 'HAL', name: 'Hallstatt', lat: 47.5622, lng: 13.6493, mode: null, tag: 'snow', from_code: 'CAB', blurb: 'Day trip from the cabin', sort_order: 4 },
    { kind: 'daytrip', code: 'GSE', name: 'Gosausee', lat: 47.5386, lng: 13.4906, mode: null, tag: 'snow', from_code: 'CAB', blurb: 'Frozen lake under the Dachstein', sort_order: 5 },
  ].map((p) => ({ ...p, itinerary_id: itin.id }))
);

// ---------------------------------------------------------------- variant
const [variant] = await ins('variants', [
  { itinerary_id: itin.id, is_default: true, sort_order: 0, date_range: 'Dec 29 – Jan 7' },
]);

// ---------------------------------------------------------------- stays
const TBC = 'Name and price still to confirm — Airbnb and Booking block automated lookups.';

// 1. Vienna — decided.
const [vienna] = await ins('stays', [
  {
    variant_id: variant.id,
    city: 'Vienna',
    label: 'Dec 29 - Jan 1 (3 nights) - CONFIRMED',
    checkin: 'Dec 29',
    checkout: 'Jan 1',
    nights: 3,
    sort_order: 0,
  },
]);
await ins('stay_options', [
  {
    stay_id: vienna.id,
    rank: 1,
    selected: true,
    sort_order: 0,
    source: 'Airbnb',
    name: 'Vienna apartment — CONFIRMED (listing 688274729214660238)',
    total_eur: 431,
    lat: 48.173896,
    lng: 16.366004,
    url: 'https://www.airbnb.com/rooms/688274729214660238?source_impression_id=p3_1788112595_P3fr-ldNSMBGFelc',
    notes: 'Booked and confirmed. Rename this row once you have the listing title.',
  },
]);

// 2. Cabin — all Compact Tour candidates, plus five new links.
const [cabin] = await ins('stays', [
  {
    variant_id: variant.id,
    city: 'Mountain cabin',
    label: 'Jan 1 - Jan 4 (3 nights) - Car Only',
    checkin: 'Jan 1',
    checkout: 'Jan 4',
    nights: 3,
    sort_order: 1,
  },
]);

const carried = [...srcCabin.stay_options]
  .sort((a, b) => a.sort_order - b.sort_order)
  .map((o, i) => ({
    stay_id: cabin.id,
    rank: i + 1,
    selected: i === 0,
    sort_order: i,
    source: o.source,
    name: o.name,
    total_eur: o.total_eur,
    notes: o.notes,
    extra_note: o.extra_note,
    url: o.url,
    address: o.address,
    lat: o.lat,
    lng: o.lng,
  }));

const newCabin = [
  { id: '43639030', url: 'https://www.airbnb.it/rooms/43639030?adults=2&check_in=2027-01-01&check_out=2027-01-04&search_mode=regular_search&photo_id=2199057526&source_impression_id=p3_0436e089-be54-40f8-864d-b1079c3b7475_097a070c-ddb4-41a5-9faa-a9fd8603d1eb_0_43639030_0&previous_page_section_name=1000&federated_search_id=0436e089-be54-40f8-864d-b1079c3b7475', note: TBC },
  { id: '1342181057131993386', url: 'https://www.airbnb.it/rooms/1342181057131993386?adults=2&check_in=2027-01-02&check_out=2027-01-04&search_mode=regular_search&children=0&infants=0&pets=0&photo_id=2078793368&source_impression_id=p3_17358ea1-ad18-4ecf-8de3-92a875611b49_ec398df5-8da6-4f87-98bb-86c32ca20170_1342181057131993386_1&previous_page_section_name=1000&federated_search_id=17358ea1-ad18-4ecf-8de3-92a875611b49', note: `${TBC} NOTE: this link is priced Jan 2 → Jan 4 (2 nights), not Jan 1 → Jan 4 like the rest — re-check it for the full three nights before comparing.` },
  { id: '51586598', url: 'https://www.airbnb.it/rooms/51586598?adults=2&check_in=2027-01-01&check_out=2027-01-04&search_mode=regular_search&photo_id=2361100674&source_impression_id=p3_17358ea1-ad18-4ecf-8de3-92a875611b49_2b1233e5-690c-45ae-8576-61365a47aa70_0_51586598_8&previous_page_section_name=1000&federated_search_id=17358ea1-ad18-4ecf-8de3-92a875611b49', note: TBC },
  { id: '813712860807068289', url: 'https://www.airbnb.it/rooms/813712860807068289?adults=2&check_in=2027-01-01&check_out=2027-01-04&search_mode=regular_search&photo_id=2143405166&source_impression_id=p3_e7f8307d-dfbf-4326-92de-883a68fc944f_39d15d5c-9418-4025-a16a-94992b744758_0_813712860807068289_2&previous_page_section_name=1000&federated_search_id=e7f8307d-dfbf-4326-92de-883a68fc944f', note: TBC },
  { id: '45355380', url: 'https://www.airbnb.it/rooms/45355380?adults=2&check_in=2027-01-01&check_out=2027-01-04&search_mode=regular_search&photo_id=1066608633&source_impression_id=p3_4edca3d1-c555-4ad2-a827-8d59c846a810_06392e80-b4c6-4a40-ae51-212f4946302b_0_45355380_9&previous_page_section_name=1000&federated_search_id=4edca3d1-c555-4ad2-a827-8d59c846a810', note: TBC },
].map((o, i) => ({
  stay_id: cabin.id,
  rank: carried.length + i + 1,
  selected: false,
  sort_order: carried.length + i,
  source: 'Airbnb',
  name: `New cabin option (listing ${o.id})`,
  total_eur: null,
  url: o.url,
  notes: o.note,
}));

await ins('stay_options', [...carried, ...newCabin]);

// 3. Innsbruck — three candidates, prices pending.
const [innsbruck] = await ins('stays', [
  {
    variant_id: variant.id,
    city: 'Innsbruck',
    label: 'Jan 4 - Jan 7 (3 nights)',
    checkin: 'Jan 4',
    checkout: 'Jan 7',
    nights: 3,
    sort_order: 2,
  },
]);
await ins('stay_options', [
  {
    stay_id: innsbruck.id, rank: 1, selected: true, sort_order: 0, source: 'Airbnb',
    name: 'Innsbruck option 1 (listing 1300812490548345688)', total_eur: null, notes: TBC,
    url: 'https://www.airbnb.com/rooms/1300812490548345688?adults=2&check_in=2027-01-04&check_out=2027-01-07&location=Innsbruck%2C%20Austria&search_mode=regular_search&photo_id=2078396878&source_impression_id=p3_1788041350_P3At317icpKrW-9K&previous_page_section_name=1001&federated_search_id=b73c8b41-13d7-49f9-948a-d01fb0711c0c',
  },
  {
    stay_id: innsbruck.id, rank: 2, selected: false, sort_order: 1, source: 'Airbnb',
    name: 'Innsbruck option 2 (listing 744913845678235895)', total_eur: null, notes: TBC,
    url: 'https://www.airbnb.com/rooms/744913845678235895?adults=2&check_in=2027-01-04&check_out=2027-01-07&search_mode=regular_search&photo_id=1531021860&source_impression_id=p3_b73c8b41-13d7-49f9-948a-d01fb0711c0c_2d891522-d04b-4c49-bb5c-357172be1863_0_744913845678235895_1&previous_page_section_name=1000&federated_search_id=b73c8b41-13d7-49f9-948a-d01fb0711c0c',
  },
  {
    stay_id: innsbruck.id, rank: 3, selected: false, sort_order: 2, source: 'Booking.com',
    name: 'Hotel Central, Innsbruck',
    total_eur: null,
    notes: `${TBC} Name taken from the link's own address (/hotel/at/hote-central) — worth confirming. The link filters to EUR 140+ per night.`,
    url: 'https://www.booking.com/hotel/at/hote-central.en-gb.html?label=nl-nl-booking-desktop-E6jBZCEiIm7Ifcm1lSb5hwS652796017383%3Apl%3Ata%3Ap1%3Ap2%3Aac%3Aap%3Aneg%3Afi%3Atikwd-65526620%3Alp9195631%3Ali%3Adec%3Adm&aid=2311236&ucfs=1&checkin=2027-01-04&checkout=2027-01-07&dest_id=-1981445&dest_type=city&group_adults=2&no_rooms=1&group_children=0&nflt=price%3DEUR-min-140-1&srpvid=1d997fe77ed20581&srepoch=1788113534&all_sr_blocks=7055302_353486118_0_2_0&highlighted_blocks=7055302_353486118_0_2_0&matching_block_id=7055302_353486118_0_2_0&atlas_src=sr_iw_title',
  },
]);

// ---------------------------------------------------------------- legs
await ins(
  'legs',
  [
    { route: 'AMS -> VIE', mode: 'flight', carrier: 'Austrian Airline', date: 'Dec 29', times: '10:00 -> 11:50', cost_total_eur: 367, note: 'Total included 1 carry on and seat selection', sort_order: 0 },
    { route: 'Wien Hbf -> Salzburg Hbf', mode: 'train', carrier: 'OeBB Railjet, direct, 2h22, twice hourly', date: 'Jan 1', times: 'tbd', cost_total_eur: 60, note: 'To be booked asap — less availability on the 1st. Reduced holiday timetable.', sort_order: 1 },
    { route: 'Rental car (Salzburg -> cabin -> SZG airport)', mode: 'car', carrier: '3 days. Pick up in Salzburg city, drop at the airport', date: 'Jan 1 - Jan 4', times: null, cost_total_eur: 365, note: 'Sixt, winter tyres and chains included. Same as the Compact Tour.', sort_order: 2 },
    { route: 'Salzburg -> Innsbruck Hbf', mode: 'train', carrier: 'ÖBB Railjet — roughly 2h', date: 'Jan 4', times: 'tbd', cost_total_eur: null, note: 'Drop the Sixt car at Salzburg airport first, then into Salzburg Hbf for the westbound train. PRICE STILL TO ADD — a Sparschiene fare booked early is usually well under the walk-up price.', sort_order: 3 },
    { route: 'INN -> AMS', mode: 'flight', carrier: 'transavia', date: 'Jan 7', times: 'tbd', cost_total_eur: 195, note: '2 passengers including checked luggage.', sort_order: 4 },
  ].map((l) => ({ ...l, variant_id: variant.id }))
);

// ---------------------------------------------------------------- days
const carriedDays = srcDays.slice(0, 6).map((d, i) => ({
  variant_id: variant.id,
  day_no: i + 1,
  date_label: d.date_label,
  title: d.title,
  description: d.description,
  tags: d.tags,
  sort_order: i,
}));

const newDays = [
  {
    day_no: 7, date_label: 'Jan 4', title: 'Cabin → Salzburg airport → Innsbruck', tags: ['snow'],
    description:
      'Check out and load the car. Drive to Salzburg Airport (~1h – 1h15) and drop the Sixt car, then into Salzburg Hbf for the westbound train to Innsbruck (~2h). Check in, walk the Altstadt — Golden Roof, Maria-Theresien-Strasse — and sort ski hire for the morning so you are not queuing at 08:00.',
  },
  {
    day_no: 8, date_label: 'Jan 5', title: 'Innsbruck — ski day 1', tags: ['snow'],
    description:
      'First full day on the snow. Beginner-friendly options near the city: Patscherkofel (the Olympic hill, gentler, good ski school) or Axamer Lizum (bigger, more varied). Nordkette is the spectacular one straight from the centre but its runs are steep — better for the view than for learning. Book ski school and hire in advance; holiday-week classes fill up. Budget roughly EUR 30-35pp/day for gear and EUR 50-70pp/day for a group lesson.',
  },
  {
    day_no: 9, date_label: 'Jan 6', title: 'Innsbruck — ski day 2', tags: ['snow'],
    description:
      'Second day, same mountain if the lesson carries over, or switch for variety. Afternoon alternative if legs are done: Nordkettenbahnen cable car from the centre to 2,000m in about 20 minutes for the view, or the Bergisel ski jump. Note 6 Jan is Epiphany, a public holiday in Austria — lifts run, but shops and some restaurants close.',
  },
  {
    day_no: 10, date_label: 'Jan 7', title: 'Innsbruck → home', tags: [],
    description:
      'Innsbruck airport sits about 15 minutes from the centre — bus F runs from the Altstadt. Transavia to Amsterdam. Time in the morning for a last coffee in the Altstadt before you go.',
  },
].map((d, i) => ({ ...d, variant_id: variant.id, sort_order: 6 + i }));

await ins('days', [...carriedDays, ...newDays]);

// ---------------------------------------------------------------- notes
const srcWarnings = src.notes
  .filter((n) => n.kind === 'warning')
  .sort((a, b) => a.sort_order - b.sort_order);

await ins('notes', [
  {
    itinerary_id: itin.id, kind: 'not_included', sort_order: 0,
    body:
      'NOT included in the total above (estimates for 2 people): Vienna 72h transport passes EUR 35 | ' +
      'Fuel + parking EUR 50-70 | Schoenbrunn + one museum EUR 98 | Hallstatt parking + Beinhaus EUR 16 | ' +
      'Salzburg → Innsbruck train, still to price | SKI: gear ~EUR 30-35pp/day and group lessons ' +
      '~EUR 50-70pp/day over two days, plus lift passes — call it EUR 400-550 for the pair | ' +
      'Food & drink ~EUR 60/day x 10 days = EUR 600.',
  },
  {
    itinerary_id: itin.id, kind: 'warning', sort_order: 1,
    body:
      'BOOK SKI SCHOOL EARLY. The first week of January is peak season in Tyrol and beginner group ' +
      'classes sell out well in advance. Hire gear at the same time.',
  },
  {
    itinerary_id: itin.id, kind: 'warning', sort_order: 2,
    body:
      '6 JANUARY IS EPIPHANY, a public holiday in Austria. Lifts and restaurants in resort run, but ' +
      'shops in town largely shut.',
  },
  {
    itinerary_id: itin.id, kind: 'warning', sort_order: 3,
    body:
      'ACCOMMODATION PRICES INCOMPLETE: the five new cabin links and all three Innsbruck options were ' +
      'added without prices, so the totals below understate the real cost. Fill them in from the admin page.',
  },
  ...srcWarnings.map((n, i) => ({
    itinerary_id: itin.id,
    kind: 'warning',
    sort_order: 4 + i,
    body: n.body,
  })),
]);

console.log(`Created "${itin.name}" (${SLUG}) — hidden.`);
console.log('  Vienna    1 option  (confirmed, EUR 431)');
console.log(`  Cabin     ${carried.length + newCabin.length} options (${carried.length} carried over, ${newCabin.length} new, prices pending)`);
console.log('  Innsbruck 3 options (prices pending)');
console.log('  5 legs, 10 days, 6 map places');
console.log('\nReview at /admin/austria_ct_inn/stays, then set it Visible.');
