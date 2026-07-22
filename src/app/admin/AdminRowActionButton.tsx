"use client";

/**
 * Small client-side wrapper around a server-action <form> so we can gate
 * the submit with a `window.confirm(...)` prompt. Server Actions can be
 * passed to a <form action={...}> directly from a Server Component, but
 * they can't run an onSubmit handler — so we wrap them here to add the
 * confirm step.
 *
 * For non-destructive actions (Restore), pass `confirmText={undefined}`
 * to skip the prompt entirely.
 */
export default function AdminRowActionButton({
  action,
  investmentId,
  label,
  confirmText,
  className,
}: {
  action: (formData: FormData) => void | Promise<void>;
  investmentId: string;
  label: React.ReactNode;
  /** If provided, prompts the user with this text before submitting. */
  confirmText?: string;
  className: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (confirmText && !window.confirm(confirmText)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="investmentId" value={investmentId} />
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}
