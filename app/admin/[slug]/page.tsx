import { redirect } from 'next/navigation';

/** Accommodation is the most common edit, so that is where the editor opens. */
export default async function EditorIndex({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/admin/${slug}/stays`);
}
