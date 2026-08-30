'use client';

import { useActionState } from 'react';
import { SCHEMA, type TableName } from '@/lib/schema';
import { saveRow, deleteRow, type ActionResult } from '@/app/admin/actions';
import { useResultToast, SavingOverlay } from './useSaveFeedback';

type Row = Record<string, unknown>;

function value(row: Row | undefined, name: string): string {
  const v = row?.[name];
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

/**
 * One row of any table, rendered from lib/schema.ts. A row with no `row` prop
 * is the "add new" form.
 *
 * Save and Delete are separate forms rather than two buttons in one, so each
 * gets its own pending state and its own result toast.
 */
export default function RowForm({
  table,
  row,
  parentId,
  slug,
  title,
}: {
  table: TableName;
  row?: Row;
  parentId?: string;
  slug: string;
  title?: string;
}) {
  const def = SCHEMA[table];
  const id = row?.id ? String(row.id) : '';
  const isNew = !id;

  const [saveState, saveAction, saving] = useActionState(saveRow, null as ActionResult | null);
  const [delState, delAction, deleting] = useActionState(deleteRow, null as ActionResult | null);
  useResultToast(saveState);
  useResultToast(delState);

  const hidden = (
    <>
      <input type="hidden" name="_table" value={table} />
      <input type="hidden" name="_id" value={id} />
      <input type="hidden" name="_slug" value={slug} />
      {parentId && <input type="hidden" name="_parent" value={parentId} />}
    </>
  );

  return (
    <div className={`adm-row${isNew ? ' adm-new' : ''}`}>
      <SavingOverlay pending={saving || deleting} label={deleting ? 'Deleting…' : 'Saving…'} />

      {title && <div className="adm-row-title">{title}</div>}

      <form action={saveAction}>
        {hidden}
        <div className="adm-grid">
          {def.fields.map((f) => (
            <label
              key={f.name}
              className={`adm-field${f.wide || f.type === 'textarea' ? ' wide' : ''}`}
            >
              <span className="adm-label">{f.label}</span>

              {f.type === 'textarea' ? (
                <textarea
                  name={f.name}
                  defaultValue={value(row, f.name)}
                  placeholder={f.placeholder}
                  required={f.required}
                  rows={2}
                />
              ) : f.type === 'select' ? (
                <select name={f.name} defaultValue={value(row, f.name) || f.options?.[0]}>
                  {f.options?.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : f.type === 'checkbox' ? (
                <input type="checkbox" name={f.name} defaultChecked={row?.[f.name] === true} />
              ) : (
                <input
                  type={f.type === 'number' ? 'number' : 'text'}
                  step={f.type === 'number' ? 'any' : undefined}
                  name={f.name}
                  defaultValue={value(row, f.name)}
                  placeholder={f.placeholder}
                  required={f.required}
                />
              )}
            </label>
          ))}
        </div>

        <div className="adm-actions">
          <button className="adm-btn primary" type="submit" disabled={saving || deleting}>
            {saving ? 'Saving…' : isNew ? `Add ${def.label.toLowerCase()}` : 'Save'}
          </button>
        </div>
      </form>

      {!isNew && (
        <form
          action={delAction}
          className="adm-row-delete"
          onSubmit={(e) => {
            if (!window.confirm(`Delete this ${def.label.toLowerCase()}? This cannot be undone.`)) {
              e.preventDefault();
            }
          }}
        >
          {hidden}
          <button className="adm-btn danger" type="submit" disabled={saving || deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </form>
      )}
    </div>
  );
}
