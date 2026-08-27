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

/** The six team-order pipeline stages, in funnel order. SINGLE source of truth
 *  for stage names so the pipeline cards and the filter dropdown always read the
 *  same. Values match the team_orders status enum. */
export const ORDER_STAGES: { value: string; title: string }[] = [
  { value: "collecting", title: "Collecting roster" },
  { value: "submitted", title: "Needs invoice" },
  { value: "quoted", title: "Awaiting payment" },
  { value: "in_production", title: "In production" },
  { value: "paid", title: "Ready to ship" },
  { value: "shipped", title: "Shipped" },
];

/** Friendly stage name for a team-order status, falling back to a humanized
 *  version of the raw value (e.g. draft/cancelled). */
export function stageTitle(value: string): string {
  const s = ORDER_STAGES.find((x) => x.value === value);
  if (s) return s.title;
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

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
