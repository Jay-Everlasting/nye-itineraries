/**
 * The editable shape of every table, in one place.
 *
 * The admin UI renders forms from this, and the server actions validate against
 * it — a column not listed here can never be written, whatever a form posts.
 */

export type FieldType = 'text' | 'textarea' | 'number' | 'checkbox' | 'select' | 'tags';

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  options?: string[];
  placeholder?: string;
  required?: boolean;
  /** Rendered full-width in the form grid. */
  wide?: boolean;
};

export type TableName =
  | 'itineraries'
  | 'variants'
  | 'places'
  | 'stays'
  | 'stay_options'
  | 'legs'
  | 'days'
  | 'notes';

export const SCHEMA: Record<TableName, { label: string; parent?: string; fields: Field[] }> = {
  itineraries: {
    label: 'Itinerary',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'slug', label: 'Slug (URL id)', type: 'text', required: true, placeholder: 'japan_2027' },
      { name: 'icon', label: 'Icon', type: 'text', placeholder: '🗾' },
      { name: 'subtitle', label: 'Subtitle', type: 'text', wide: true },
      { name: 'countries', label: 'Countries', type: 'text' },
      { name: 'date_label', label: 'Dates', type: 'text', placeholder: 'Dec 28 – Jan 4 · 8 days' },
      { name: 'departure', label: 'Departure', type: 'text', placeholder: 'Amsterdam (AMS)' },
      { name: 'tags', label: 'Tags (comma separated)', type: 'tags', placeholder: 'snow, nye' },
      { name: 'sort_order', label: 'Order', type: 'number' },
      { name: 'published', label: 'Visible on the site', type: 'checkbox' },
      { name: 'flag', label: 'Warning banner', type: 'textarea', wide: true },
      { name: 'note', label: 'Closing note', type: 'textarea', wide: true },
      { name: 'owner_note', label: 'Your note', type: 'textarea', wide: true },
      { name: 'map_caption', label: 'Map caption', type: 'textarea', wide: true },
    ],
  },
  variants: {
    label: 'Date window',
    parent: 'itinerary_id',
    fields: [
      { name: 'label', label: 'Label', type: 'text', placeholder: 'Window A' },
      { name: 'date_range', label: 'Date range', type: 'text', placeholder: 'Dec 29 → Jan 5' },
      { name: 'flight_note', label: 'Travel note', type: 'textarea', wide: true },
      { name: 'sort_order', label: 'Order', type: 'number' },
      { name: 'is_default', label: 'Default window', type: 'checkbox' },
    ],
  },
  places: {
    label: 'Map place',
    parent: 'itinerary_id',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'code', label: 'Code', type: 'text', placeholder: 'VIE' },
      { name: 'kind', label: 'Kind', type: 'select', options: ['route', 'daytrip'] },
      { name: 'lat', label: 'Latitude', type: 'number' },
      { name: 'lng', label: 'Longitude', type: 'number' },
      { name: 'mode', label: 'Arrive by', type: 'text', placeholder: '🚆 train · 2h' },
      { name: 'tag', label: 'Tag', type: 'text', placeholder: 'snow' },
      { name: 'from_code', label: 'Day trip from', type: 'text', placeholder: 'VIE' },
      { name: 'blurb', label: 'Blurb', type: 'textarea', wide: true },
      { name: 'sort_order', label: 'Order', type: 'number' },
    ],
  },
  stays: {
    label: 'Stay',
    parent: 'variant_id',
    fields: [
      { name: 'city', label: 'City', type: 'text', required: true },
      { name: 'label', label: 'Dates label', type: 'text', placeholder: 'Dec 29 – Jan 1 (3 nights)' },
      { name: 'checkin', label: 'Check in', type: 'text' },
      { name: 'checkout', label: 'Check out', type: 'text' },
      { name: 'nights', label: 'Nights', type: 'number' },
      { name: 'sort_order', label: 'Order', type: 'number' },
    ],
  },
  stay_options: {
    label: 'Option',
    parent: 'stay_id',
    fields: [
      { name: 'name', label: 'Property', type: 'text', required: true, wide: true },
      { name: 'source', label: 'Source', type: 'text', placeholder: 'Airbnb' },
      { name: 'total_eur', label: 'Total €', type: 'number' },
      { name: 'rank', label: 'Rank', type: 'number' },
      { name: 'selected', label: 'This is the pick', type: 'checkbox' },
      { name: 'url', label: 'Link', type: 'text', wide: true },
      { name: 'address', label: 'Address', type: 'text', wide: true },
      { name: 'lat', label: 'Latitude', type: 'number' },
      { name: 'lng', label: 'Longitude', type: 'number' },
      { name: 'notes', label: 'Your note', type: 'textarea', wide: true },
      { name: 'extra_note', label: 'Extra note', type: 'textarea', wide: true },
      { name: 'sort_order', label: 'Order', type: 'number' },
    ],
  },
  legs: {
    label: 'Travel leg',
    parent: 'variant_id',
    fields: [
      { name: 'route', label: 'Route', type: 'text', required: true, placeholder: 'AMS → VIE' },
      { name: 'mode', label: 'Mode', type: 'select', options: ['flight', 'train', 'car', 'ferry', 'bus'] },
      { name: 'carrier', label: 'Carrier', type: 'text' },
      { name: 'date', label: 'Date', type: 'text' },
      { name: 'dep', label: 'Departs', type: 'text' },
      { name: 'arr', label: 'Arrives', type: 'text' },
      { name: 'times', label: 'Times (free text)', type: 'text', wide: true },
      { name: 'cost_total_eur', label: 'Cost € (for 2)', type: 'number' },
      { name: 'note', label: 'Note', type: 'textarea', wide: true },
      { name: 'sort_order', label: 'Order', type: 'number' },
    ],
  },
  days: {
    label: 'Day',
    parent: 'variant_id',
    fields: [
      { name: 'day_no', label: 'Day #', type: 'number' },
      { name: 'date_label', label: 'Date', type: 'text', placeholder: 'Dec 29' },
      { name: 'title', label: 'Title', type: 'text', required: true, wide: true },
      { name: 'description', label: 'What you do', type: 'textarea', wide: true },
      { name: 'tags', label: 'Tags', type: 'tags', placeholder: 'snow, nye' },
      { name: 'sort_order', label: 'Order', type: 'number' },
    ],
  },
  notes: {
    label: 'Note',
    parent: 'itinerary_id',
    fields: [
      { name: 'kind', label: 'Kind', type: 'select', options: ['info', 'warning', 'not_included'] },
      { name: 'body', label: 'Text', type: 'textarea', required: true, wide: true },
      { name: 'sort_order', label: 'Order', type: 'number' },
    ],
  },
};

/** Coerce one posted form value to the column's type. */
export function coerce(field: Field, raw: FormDataEntryValue | null): unknown {
  if (field.type === 'checkbox') return raw === 'on' || raw === 'true';
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (field.type === 'number') {
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  if (field.type === 'tags') {
    return s ? s.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean) : [];
  }
  return s === '' ? null : s;
}

/**
 * Columns that are NOT NULL in the database but optional in the form. Leaving
 * one blank must fall back to the default rather than posting null, which
 * Postgres rejects.
 */
const NEVER_NULL: Record<string, unknown> = { sort_order: 0 };

/** Build a validated row from a form, ignoring anything not in the schema. */
export function rowFromForm(table: TableName, form: FormData): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const field of SCHEMA[table].fields) {
    // An absent checkbox means false; other absent fields are left untouched.
    if (!form.has(field.name) && field.type !== 'checkbox') continue;
    const v = coerce(field, form.get(field.name));
    row[field.name] = v === null && field.name in NEVER_NULL ? NEVER_NULL[field.name] : v;
  }
  return row;
}
