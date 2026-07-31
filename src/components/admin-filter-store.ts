"use client";

import { useSyncExternalStore, useCallback } from "react";

// Shared client-side status filter for the admin dashboard, so controls in more
// than one place (the top search bar and the Team Orders header chips) drive a
// single filter without fighting each other over row visibility.
let status = "";
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Order-pipeline status chips, in funnel order. Values match the team_orders
 *  status enum carried on each row's data-status. */
export const STAGE_CHIPS: { label: string; value: string }[] = [
  { label: "📋 New roster", value: "submitted" },
  { label: "🧾 Invoiced", value: "quoted" },
  { label: "💰 Deposit paid", value: "in_production" },
  { label: "💸 Paid in full", value: "paid" },
  { label: "🚚 Shipped", value: "shipped" },
];

export function useStatusFilter(): [string, (s: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => status,
    () => "",
  );
  const set = useCallback((s: string) => {
    status = s;
    emit();
  }, []);
  return [value, set];
}
