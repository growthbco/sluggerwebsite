import { LARGE_ORDER_RUSH_FEE_CENTS, LARGE_ORDER_RUSH_PIECES, RUSH_FEE_CENTS } from "@/lib/customer-policy";

export { RUSH_FEE_CENTS } from "@/lib/customer-policy";

/** One order-level fee based on its billable piece count, not player count. Availability and
 * any promised date still require staff approval. The internal one-week
 * priority option is quoted manually and never added here automatically. */
export function rushFeeCentsForPieces(pieces: number): number {
  const quantity = Number.isFinite(pieces) ? Math.max(0, Math.floor(pieces)) : 0;
  if (quantity === 0) return 0;
  return quantity >= LARGE_ORDER_RUSH_PIECES ? LARGE_ORDER_RUSH_FEE_CENTS : RUSH_FEE_CENTS;
}
