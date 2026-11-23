"use client";

import { useActionState } from "react";
import type { OrderStatus } from "@prisma/client";
import {
  updateOrderStatusAction,
  type AdminActionState,
} from "@/lib/admin-actions";
import { ORDER_STATUS_LABELS } from "@/lib/order-labels";

type AdminOrderStatusFormProps = {
  orderId: string;
  currentStatus: OrderStatus;
};

const STATUSES: OrderStatus[] = [
  "NEW",
  "IN_PROGRESS",
  "COMPLETED",
  "REJECTED",
];

const initialState: AdminActionState = {};

export function AdminOrderStatusForm({
  orderId,
  currentStatus,
}: AdminOrderStatusFormProps) {
  const [state, formAction, pending] = useActionState(
    updateOrderStatusAction,
    initialState,
  );

  return (
    <div className="admin-status-wrap">
      <form action={formAction} className="admin-status-form">
        <input type="hidden" name="id" value={orderId} />
        <label>
          Status
          <select
            key={currentStatus}
            name="status"
            defaultValue={currentStatus}
            disabled={pending}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {ORDER_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-secondary" disabled={pending}>
          {pending ? "Zapisywanie…" : "Zmień"}
        </button>
      </form>
      {state.error && (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      )}
      {state.success && !state.error && (
        <p className="admin-inline-ok" role="status">
          {state.success}
        </p>
      )}
    </div>
  );
}
