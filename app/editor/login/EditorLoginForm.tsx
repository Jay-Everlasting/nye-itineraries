'use client';

import { useActionState } from 'react';
import { sendEditCode, verifyEditCode } from '../../actions/auth';

type SendState = { error?: string; sent?: boolean; email?: string; next?: string } | null;

export default function EditorLoginForm({ next }: { next: string }) {
  const [sendState, sendAction, sending] = useActionState(sendEditCode, null as SendState);
  const [verifyState, verifyAction, verifying] = useActionState(verifyEditCode, null as SendState);

  // Once a code has gone out, switch to the code form.
  const stage = verifyState?.sent || sendState?.sent ? 'code' : 'email';
  const email = verifyState?.email ?? sendState?.email ?? '';

  if (stage === 'code') {
    return (
      <div className="auth-wrap">
        <form className="auth-card" action={verifyAction}>
          <div className="auth-icon">✉️</div>
          <h1 className="auth-title">Check your email</h1>
          <p className="auth-sub">
            We sent a one-time code to <b>{email}</b>. It expires shortly.
          </p>

          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="next" value={next} />
          <input
            className="auth-input auth-code"
            type="text"
            name="token"
            placeholder="000000"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            required
          />

          {verifyState?.error && <div className="auth-error">{verifyState.error}</div>}

          <button className="auth-btn" type="submit" disabled={verifying}>
            {verifying ? 'Verifying…' : 'Unlock editing for 6 hours'}
          </button>

          <a className="auth-link" href="/editor/login">
            Use a different address
          </a>
        </form>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" action={sendAction}>
        <div className="auth-icon">🔑</div>
        <h1 className="auth-title">Editor sign-in</h1>
        <p className="auth-sub">
          Enter your email and we&rsquo;ll send a one-time code. Only allowlisted addresses can
          edit.
        </p>

        <input type="hidden" name="next" value={next} />
        <input
          className="auth-input"
          type="email"
          name="email"
          placeholder="you@example.com"
          autoComplete="email"
          autoFocus
          required
        />

        {sendState?.error && <div className="auth-error">{sendState.error}</div>}

        <button className="auth-btn" type="submit" disabled={sending}>
          {sending ? 'Sending…' : 'Send code'}
        </button>

        <a className="auth-link" href="/login">
          ← Just here to read
        </a>
      </form>
    </div>
  );
}
