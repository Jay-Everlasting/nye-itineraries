import { cookies } from 'next/headers';
import { admin } from '@/lib/supabase/admin';
import { EDIT_COOKIE, verifySession } from '@/lib/auth';
import { signOutEditor } from '../actions/auth';
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
    <div className="page-inner" style={{ maxWidth: 860 }}>
      <div className="page-icon">🛠️</div>
      <h1>Manage itineraries</h1>
      <div className="page-sub">
        Signed in as <b>{session?.email}</b> · session ends in {hrs}h {String(mins).padStart(2, '0')}m
      </div>

      <div className="props">
        <div className="prow">
          <div className="plabel">📋 Itineraries</div>
          <div className="pvalue">{itineraries?.length ?? 0}</div>
        </div>
        <div className="prow">
          <div className="plabel">👥 Editors</div>
          <div className="pvalue">{editors?.map((e) => e.email).join(', ') || '—'}</div>
        </div>
      </div>

      <div className="callout">
        Editors are managed from your machine, not here — a signed-in editor cannot grant access to
        anyone else. Use <code>npm run editors -- add someone@example.com</code>.
      </div>

      <hr className="div" />
      <h2 className="sec">📋 Itineraries</h2>

      <div className="table-wrap">
        <table className="ntable">
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>Contents</th>
              <th style={{ textAlign: 'right' }}>Visible</th>
            </tr>
          </thead>
          <tbody>
            {(itineraries ?? []).map((it) => {
              const variants = (it.variants ?? []) as { stays: unknown[]; days: unknown[] }[];
              const stays = variants.reduce((n, v) => n + (v.stays?.length ?? 0), 0);
              const days = variants.reduce((n, v) => n + (v.days?.length ?? 0), 0);
              return (
                <tr key={it.id}>
                  <td style={{ fontSize: 18 }}>{it.icon}</td>
                  <td>
                    <div className="hname">{it.name}</div>
                    <div className="hsub">{it.slug}</div>
                  </td>
                  <td className="hsub">
                    {variants.length} variant{variants.length === 1 ? '' : 's'} · {stays} stays ·{' '}
                    {days} days
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <PublishToggle id={it.id} published={it.published} name={it.name} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="callout">
        Hiding an itinerary removes it from the site within 5 minutes without deleting anything —
        useful for a trip you have ruled out but want to keep.
      </div>

      <hr className="div" />
      <form action={signOutEditor}>
        <button className="gt-btn" type="submit">
          Sign out of editing
        </button>
      </form>
      <div className="side-foot" style={{ border: 'none', marginTop: 8 }}>
        Signing out ends editing only. You stay signed in for reading.
      </div>
    </div>
  );
}
