'use client';

import { useActionState } from 'react';
import { saveRow, deleteRow, type ActionResult } from '@/app/admin/actions';
import { useResultToast, SavingOverlay } from './useSaveFeedback';

type Row = Record<string, unknown>;

const str = (row: Row | undefined, k: string) => {
  const v = row?.[k];
  return v === null || v === undefined ? '' : String(v);
};

/**
 * One accommodation option as a single line: pick, rank, name, source, price,
 * link, delete. Everything you rarely touch — address, coordinates, notes,
 * order — lives in a native <details>, so expanding needs no JavaScript.
 */
export default function OptionRow({
  option,
  stayId,
  slug,
  isNew = false,
  city,
}: {
  option?: Row;
  stayId: string;
  slug: string;
  isNew?: boolean;
  /** Shown on the add row so it is obvious which city it belongs to. */
  city?: string;
}) {
  const id = option?.id ? String(option.id) : '';

  const [saveState, saveAction, saving] = useActionState(saveRow, null as ActionResult | null);
  const [delState, delAction, deleting] = useActionState(deleteRow, null as ActionResult | null);
  useResultToast(saveState);
  useResultToast(delState);

  const hidden = (
    <>
      <input type="hidden" name="_table" value="stay_options" />
      <input type="hidden" name="_id" value={id} />
      <input type="hidden" name="_slug" value={slug} />
      <input type="hidden" name="_parent" value={stayId} />
    </>
  );

  return (
    <div className={`opt-row${isNew ? ' opt-new' : ''}`}>
      <SavingOverlay pending={saving || deleting} label={deleting ? 'Deleting…' : 'Saving…'} />

      {isNew && (
        <div className="opt-add-label">➕ Add another place to stay in {city ?? 'this city'}</div>
      )}

      <form action={saveAction}>
        {hidden}
        <div className="opt-line">
          <label className="opt-pick" title="This is the chosen option">
            <input type="checkbox" name="selected" defaultChecked={option?.selected === true} />
          </label>

          <input
            className="opt-rank"
            type="number"
            name="rank"
            defaultValue={str(option, 'rank')}
            placeholder="#"
            aria-label="Rank"
          />

          <input
            className="opt-name"
            type="text"
            name="name"
            defaultValue={str(option, 'name')}
            placeholder={isNew ? 'Property name' : ''}
            required
            aria-label="Property"
          />

          <input
            className="opt-source"
            type="text"
            name="source"
            defaultValue={str(option, 'source')}
            placeholder="Airbnb"
            aria-label="Source"
          />

          <div className="opt-price-wrap">
            <span className="opt-cur">€</span>
            <input
              className="opt-price"
              type="number"
              step="any"
              name="total_eur"
              defaultValue={str(option, 'total_eur')}
              placeholder="0"
              aria-label="Total price in euros"
            />
          </div>

          <input
            className="opt-url"
            type="text"
            name="url"
            defaultValue={str(option, 'url')}
            placeholder="https://…"
            aria-label="Link"
          />

          <button className="adm-btn primary opt-save" type="submit" disabled={saving || deleting}>
            {saving ? '…' : isNew ? 'Add' : 'Save'}
          </button>

          <span className="opt-del-slot" />
        </div>

        <details className="opt-more">
          <summary>More</summary>
          <div className="adm-grid">
            <label className="adm-field wide">
              <span className="adm-label">Your note</span>
              <textarea name="notes" defaultValue={str(option, 'notes')} rows={2} />
            </label>
            <label className="adm-field wide">
              <span className="adm-label">Extra note</span>
              <textarea name="extra_note" defaultValue={str(option, 'extra_note')} rows={2} />
            </label>
            <label className="adm-field wide">
              <span className="adm-label">Address (for the map pin)</span>
              <input type="text" name="address" defaultValue={str(option, 'address')} />
            </label>
            <label className="adm-field">
              <span className="adm-label">Latitude</span>
              <input type="number" step="any" name="lat" defaultValue={str(option, 'lat')} />
            </label>
            <label className="adm-field">
              <span className="adm-label">Longitude</span>
              <input type="number" step="any" name="lng" defaultValue={str(option, 'lng')} />
            </label>
            <label className="adm-field">
              <span className="adm-label">Order</span>
              <input type="number" name="sort_order" defaultValue={str(option, 'sort_order')} />
            </label>
          </div>
        </details>
      </form>

      {!isNew && (
        <form
          action={delAction}
          className="opt-del-form"
          onSubmit={(e) => {
            if (!window.confirm(`Delete "${str(option, 'name')}"? This cannot be undone.`)) {
              e.preventDefault();
            }
          }}
        >
          {hidden}
          <button className="adm-btn danger" type="submit" disabled={saving || deleting}>
            ✕
          </button>
        </form>
      )}
    </div>
  );
}
