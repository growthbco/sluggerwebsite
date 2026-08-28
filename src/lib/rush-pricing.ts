export const RUSH_FEE_CENTS = 10000;

/** One flat $100 rush fee for every non-empty order. Availability and the
 * promised date still require staff approval. */
export function rushFeeCentsForPieces(pieces: number): number {
  const quantity = Math.max(0, Math.floor(pieces));
  if (quantity === 0) return 0;
  return RUSH_FEE_CENTS;
}
