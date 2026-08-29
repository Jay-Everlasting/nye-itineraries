'use client';

import { usePathname } from 'next/navigation';
import { SECTIONS } from '@/lib/admin-sections';

export default function SectionNav({ slug }: { slug: string }) {
  const path = usePathname();
  const current = path.split('/')[3] ?? 'stays';

  return (
    <nav className="adm-tabs">
      {SECTIONS.map((s) => (
        <a
          key={s.key}
          href={`/admin/${slug}/${s.key}`}
          className={`adm-tab${s.key === current ? ' on' : ''}`}
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}
