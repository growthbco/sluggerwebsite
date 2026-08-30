import { RUSH_FEE_CENTS } from "@/lib/customer-policy";

export { RUSH_FEE_CENTS } from "@/lib/customer-policy";

/** One flat $100 two-week rush fee for every non-empty order. Availability and
 * any promised date still require staff approval. The internal one-week
 * priority option is quoted manually and never added here automatically. */
export function rushFeeCentsForPieces(pieces: number): number {
  const quantity = Math.max(0, Math.floor(pieces));
  if (quantity === 0) return 0;
  return RUSH_FEE_CENTS;
}
