'use client';

import { useState, useTransition } from 'react';
import { setPublished } from './actions';

export default function PublishToggle({
  id,
  published,
  name,
}: {
  id: string;
  published: boolean;
  name: string;
}) {
  const [on, setOn] = useState(published);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        className="gt-btn"
        disabled={pending}
        aria-label={`${on ? 'Hide' : 'Show'} ${name}`}
        onClick={() =>
          start(async () => {
            const next = !on;
            setOn(next);
            setError(null);
            try {
              await setPublished(id, next);
            } catch (e) {
              setOn(!next); // roll back
              setError(e instanceof Error ? e.message : 'Failed');
            }
          })
        }
      >
        {pending ? '…' : on ? '👁 Visible' : '🚫 Hidden'}
      </button>
      {error && <div className="auth-error" style={{ marginTop: 6 }}>{error}</div>}
    </>
  );
}
