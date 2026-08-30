'use client';

import { useActionState } from 'react';
import { deleteRow, type ActionResult } from '@/app/admin/actions';
import { useResultToast } from './useSaveFeedback';
import type { TableName } from '@/lib/schema';

/** Standalone delete for a row that has no form of its own — e.g. a whole city. */
export default function RemoveRowButton({
  table,
  id,
  slug,
  label,
  confirmText,
}: {
  table: TableName;
  id: string;
  slug: string;
  label: string;
  confirmText: string;
}) {
  const [state, action, pending] = useActionState(deleteRow, null as ActionResult | null);
  useResultToast(state);

  return (
    <form
      action={action}
      className="adm-card-del"
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    >
      <input type="hidden" name="_table" value={table} />
      <input type="hidden" name="_id" value={id} />
      <input type="hidden" name="_slug" value={slug} />
      <button className="adm-btn danger" type="submit" disabled={pending}>
        {pending ? 'Removing…' : label}
      </button>
    </form>
  );
}
