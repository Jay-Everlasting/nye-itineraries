'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { ActionResult } from '@/app/admin/actions';

/**
 * Turns an action result into a toast, and renders the blocking overlay while
 * the action is in flight.
 *
 * The result carries `at` (a timestamp), so saving the same row twice with the
 * same outcome still fires a second toast — without it, React would see an
 * identical object and the effect would not re-run.
 */
export function useResultToast(state: ActionResult | null) {
  const lastAt = useRef<number>(0);

  useEffect(() => {
    if (!state || state.at === lastAt.current) return;
    lastAt.current = state.at;

    if (state.ok) {
      toast.success(state.message);
    } else {
      // Errors stay until dismissed — a failed save must not scroll past unseen.
      toast.error(state.error, { duration: Infinity, closeButton: true });
    }
  }, [state]);
}

/**
 * Full-screen veil shown while a save is running. Blocks clicks so you cannot
 * fire a second save into the same row, and makes it obvious when it is safe
 * to carry on.
 */
export function SavingOverlay({ pending, label = 'Saving…' }: { pending: boolean; label?: string }) {
  if (!pending) return null;
  return (
    <div className="save-veil" role="status" aria-live="polite">
      <div className="save-veil-box">
        <span className="save-spinner" aria-hidden="true" />
        {label}
      </div>
    </div>
  );
}
