import { Toaster } from 'sonner';

/**
 * Wraps every admin screen so save/delete feedback has somewhere to land.
 * richColors gives success green / error red without custom styling.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster position="bottom-right" richColors expand closeButton />
    </>
  );
}
