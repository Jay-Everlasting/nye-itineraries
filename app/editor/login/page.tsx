import EditorLoginForm from './EditorLoginForm';

export const dynamic = 'force-dynamic';

export default async function EditorLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <EditorLoginForm next={next ?? '/admin'} />;
}
