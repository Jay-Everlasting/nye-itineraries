import { SCHEMA, type TableName } from '@/lib/schema';
import { saveRow, deleteRow } from '@/app/admin/actions';

type Row = Record<string, unknown>;

function value(row: Row | undefined, name: string): string {
  const v = row?.[name];
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

/**
 * One row of any table, rendered from lib/schema.ts. A row with no `row` prop
 * is the "add new" form. Plain forms + server actions — no client state, so a
 * failed save shows Next's error rather than silently losing your typing.
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

  return (
    <form action={saveRow} className={`adm-row${isNew ? ' adm-new' : ''}`}>
      <input type="hidden" name="_table" value={table} />
      <input type="hidden" name="_id" value={id} />
      <input type="hidden" name="_slug" value={slug} />
      {parentId && <input type="hidden" name="_parent" value={parentId} />}

      {title && <div className="adm-row-title">{title}</div>}

      <div className="adm-grid">
        {def.fields.map((f) => (
          <label key={f.name} className={`adm-field${f.wide || f.type === 'textarea' ? ' wide' : ''}`}>
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
        <button className="adm-btn primary" type="submit">
          {isNew ? `Add ${def.label.toLowerCase()}` : 'Save'}
        </button>
        {!isNew && (
          <button className="adm-btn danger" type="submit" formAction={deleteRow}>
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
