export const RUSH_MIN_CENTS = 10000;
export const RUSH_PER_PIECE_CENTS = 500;

/** Rush starts at $100 and scales at $5 per billable piece for orders over
 * 20 pieces. Availability and the promised date still require staff approval. */
export function rushFeeCentsForPieces(pieces: number): number {
  const quantity = Math.max(0, Math.floor(pieces));
  if (quantity === 0) return 0;
  return Math.max(RUSH_MIN_CENTS, quantity * RUSH_PER_PIECE_CENTS);
}
