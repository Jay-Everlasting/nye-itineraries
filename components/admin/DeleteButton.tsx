'use client';

/**
 * Submit button that confirms before firing its server action. Kept client-side
 * only for the confirm(); the deletion itself still runs on the server, which
 * re-checks the edit session.
 */
export default function DeleteButton({
  action,
  label = 'Delete',
  confirmText,
}: {
  action: (formData: FormData) => Promise<void>;
  label?: string;
  confirmText: string;
}) {
  return (
    <button
      className="adm-btn danger"
      type="submit"
      formAction={action}
      onClick={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    >
      {label}
    </button>
  );
}
