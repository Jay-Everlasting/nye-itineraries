'use client';

import { useActionState } from 'react';
import { submitReadPassword } from '../actions/auth';

export default function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(submitReadPassword, null as { error?: string } | null);

  return (
    <div className="auth-wrap">
      <form className="auth-card" action={action}>
        <div className="auth-icon">🧭</div>
        <h1 className="auth-title">Trip itineraries</h1>
        <p className="auth-sub">Enter the password to view the trips.</p>

        <input type="hidden" name="next" value={next} />
        <input
          className="auth-input"
          type="password"
          name="password"
          placeholder="Password"
          autoComplete="current-password"
          autoFocus
          required
        />

        {state?.error && <div className="auth-error">{state.error}</div>}

        <button className="auth-btn" type="submit" disabled={pending}>
          {pending ? 'Checking…' : 'Continue'}
        </button>

        <a className="auth-link" href="/editor/login">
          I need to edit the itineraries →
        </a>
      </form>
    </div>
  );
}
