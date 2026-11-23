"use client";

import { useActionState } from "react";
import type { AdminActionState } from "@/lib/admin-actions";

type AdminActionFormProps = {
  id: string;
  action: (
    prev: AdminActionState,
    formData: FormData,
  ) => Promise<AdminActionState>;
  label: string;
  pendingLabel?: string;
  className?: string;
  confirmMessage?: string;
};

const initialState: AdminActionState = {};

export function AdminActionForm({
  id,
  action,
  label,
  pendingLabel = "…",
  className,
  confirmMessage,
}: AdminActionFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="admin-inline-form">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className={className}
        disabled={pending}
        onClick={(event) => {
          if (confirmMessage && !window.confirm(confirmMessage)) {
            event.preventDefault();
          }
        }}
      >
        {pending ? pendingLabel : label}
      </button>
      {state.error && (
        <span className="admin-inline-error" role="alert">
          {state.error}
        </span>
      )}
    </form>
  );
}
