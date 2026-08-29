import { cookies } from 'next/headers';
import { admin } from '@/lib/supabase/admin';
import { EDIT_COOKIE, verifySession } from '@/lib/auth';
import { signOutEditor } from '../actions/auth';
import { createItinerary } from './actions';
import PublishToggle from './PublishToggle';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const jar = await cookies();
  const session = await verifySession<{ email: string; exp: number }>(jar.get(EDIT_COOKIE)?.value);

  const db = admin();
  const [{ data: itineraries }, { data: editors }] = await Promise.all([
    db
      .from('itineraries')
      .select('id, slug, icon, name, published, sort_order, variants(id, stays(id), days(id))')
      .order('sort_order'),
    db.from('editors').select('email').order('email'),
  ]);

  const minutesLeft = session ? Math.max(0, Math.round((session.exp - Date.now()) / 60000)) : 0;
  const hrs = Math.floor(minutesLeft / 60);
  const mins = minutesLeft % 60;

  return (
    <div className="adm-wrap">
      <div className="adm-head">
        <a className="adm-back" href="/">
          ← Back to the trips
        </a>
        <h1>🛠️ Manage itineraries</h1>
        <div className="adm-sub">
          Signed in as <b>{session?.email}</b> · editing ends in {hrs}h{' '}
          {String(mins).padStart(2, '0')}m
        </div>
      </div>

      <h2 className="adm-h2">Itineraries</h2>
      <div className="adm-list">
        {(itineraries ?? []).map((it) => {
          const variants = (it.variants ?? []) as { stays: unknown[]; days: unknown[] }[];
          const stays = variants.reduce((n, v) => n + (v.stays?.length ?? 0), 0);
          const days = variants.reduce((n, v) => n + (v.days?.length ?? 0), 0);
          return (
            <div className="adm-item" key={it.id}>
              <span className="adm-item-icon">{it.icon}</span>
              <span className="adm-item-main">
                <a className="adm-item-name" href={`/admin/${it.slug}`}>
                  {it.name}
                </a>
                <span className="adm-item-meta">
                  {variants.length} window{variants.length === 1 ? '' : 's'} · {stays} stays ·{' '}
                  {days} days
                </span>
              </span>
              <PublishToggle id={it.id} published={it.published} name={it.name} />
              <a className="adm-btn" href={`/admin/${it.slug}`}>
                Edit →
              </a>
            </div>
          );
        })}
      </div>

      <h2 className="adm-h2">Create a new itinerary</h2>
      <form action={createItinerary} className="adm-row adm-new">
        <p className="adm-help">
          Starts empty and hidden, with one date window ready. Fill it in on the next screen, then
          switch it to visible. To base it on an existing trip, open that trip and use Duplicate
          instead.
        </p>
        <div className="adm-grid">
          <label className="adm-field">
            <span className="adm-label">Name</span>
            <input type="text" name="name" placeholder="Japan 2027" required />
          </label>
          <label className="adm-field">
            <span className="adm-label">Slug (URL id)</span>
            <input type="text" name="slug" placeholder="japan_2027" required />
          </label>
          <label className="adm-field">
            <span className="adm-label">Icon</span>
            <input type="text" name="icon" placeholder="🗾" />
          </label>
        </div>
        <div className="adm-actions">
          <button className="adm-btn primary" type="submit">
            Create itinerary
          </button>
        </div>
      </form>

      <h2 className="adm-h2">Who can edit</h2>
      <div className="adm-row">
        <p className="adm-help">
          {editors?.map((e) => e.email).join(', ') || 'Nobody yet.'}
        </p>
        <p className="adm-help">
          Access is granted in Supabase only — Table Editor → <code>editors</code> → Insert row,
          lowercase. A signed-in editor cannot grant access to anyone else.
        </p>
      </div>

      <hr className="div" />
      <form action={signOutEditor}>
        <button className="adm-btn" type="submit">
          Sign out of editing
        </button>
      </form>
      <p className="adm-help">Ends editing only. You stay signed in for reading.</p>
    </div>
  );
}
