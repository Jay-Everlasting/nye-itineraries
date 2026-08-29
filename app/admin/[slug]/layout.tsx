import { notFound } from 'next/navigation';
import { admin } from '@/lib/supabase/admin';
import SectionNav from '@/components/admin/SectionNav';

export const dynamic = 'force-dynamic';

export default async function EditorLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { data: it } = await admin()
    .from('itineraries')
    .select('id, slug, icon, name, published')
    .eq('slug', slug)
    .maybeSingle();

  if (!it) notFound();

  return (
    <div className="adm-wrap wide">
      <div className="adm-head">
        <a className="adm-back" href="/admin">
          ← All itineraries
        </a>
        <h1>
          {it.icon} {it.name}
        </h1>
        <div className="adm-sub">
          {it.published ? '👁 Visible on the site' : '🚫 Hidden — not shown on the site'} ·{' '}
          <a href={`/?open=${slug}`} target="_blank" rel="noopener noreferrer">
            View ↗
          </a>
        </div>
      </div>

      <SectionNav slug={slug} />
      <div className="adm-desktop-hint">
        This editor is built for a bigger screen — fine for a quick price change here, but easier on
        a computer.
      </div>

      {children}
    </div>
  );
}
