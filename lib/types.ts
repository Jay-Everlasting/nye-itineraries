export type Tag = 'snow' | 'nye' | 'warm' | 'aurora';

export const TAG_LABEL: Record<string, string> = {
  snow: '❄ Snow',
  nye: '🎆 NYE',
  warm: '☀ Warm',
  aurora: '🌌 Aurora',
};

export type Place = {
  id: string;
  kind: 'route' | 'daytrip';
  code: string | null;
  name: string;
  lat: number | null;
  lng: number | null;
  mode: string | null;
  tag: string | null;
  blurb: string | null;
  from_code: string | null;
  sort_order: number;
};

export type StayOption = {
  id: string;
  rank: number | null;
  source: string | null;
  name: string;
  total_eur: number | null;
  notes: string | null;
  extra_note: string | null;
  url: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  selected: boolean;
  sort_order: number;
};

export type Stay = {
  id: string;
  city: string;
  label: string | null;
  checkin: string | null;
  checkout: string | null;
  nights: number | null;
  sort_order: number;
  stay_options: StayOption[];
};

export type Leg = {
  id: string;
  route: string;
  mode: string | null;
  carrier: string | null;
  date: string | null;
  dep: string | null;
  arr: string | null;
  times: string | null;
  cost_total_eur: number | null;
  note: string | null;
  sort_order: number;
};

export type Day = {
  id: string;
  day_no: number | null;
  date_label: string | null;
  title: string;
  description: string | null;
  tags: string[];
  sort_order: number;
};

export type Variant = {
  id: string;
  label: string | null;
  date_range: string | null;
  day_dates: string[] | null;
  flight_note: string | null;
  sort_order: number;
  is_default: boolean;
  stays: Stay[];
  legs: Leg[];
  days: Day[];
};

export type Note = {
  id: string;
  kind: 'warning' | 'not_included' | 'info';
  body: string;
  sort_order: number;
};

export type Itinerary = {
  id: string;
  slug: string;
  icon: string | null;
  name: string;
  subtitle: string | null;
  countries: string | null;
  date_label: string | null;
  departure: string | null;
  note: string | null;
  owner_note: string | null;
  map_caption: string | null;
  flag: string | null;
  tags: string[];
  sort_order: number;
  places: Place[];
  variants: Variant[];
  notes: Note[];
};

/** Travel + accommodation for one variant, given the current picks. */
export function variantTotals(variant: Variant, picks: Record<string, string> = {}) {
  const travel = variant.legs.reduce((s, l) => s + Number(l.cost_total_eur || 0), 0);
  const accom = variant.stays.reduce((s, stay) => {
    const pick = pickFor(stay, picks);
    return s + Number(pick?.total_eur || 0);
  }, 0);
  const total = travel + accom;
  return { travel, accom, total, perPerson: Math.round(total / 2) };
}

/** The chosen option for a stay: local override first, then the stored pick. */
export function pickFor(stay: Stay, picks: Record<string, string> = {}): StayOption | undefined {
  const overrideId = picks[stay.id];
  if (overrideId) {
    const found = stay.stay_options.find((o) => o.id === overrideId);
    if (found) return found;
  }
  return stay.stay_options.find((o) => o.selected) ?? stay.stay_options[0];
}
