export type TeamOrderShippingChoice = "auto" | "pickup";

/** Whether a team-order invoice should add a customer-paid shipping charge.
 * Rush orders ship directly from production, and that shipping is included in
 * the flat Rush fee. An explicit staff shipping choice still controls standard
 * orders, including overriding an order that was previously marked pickup. */
export function shouldChargeAdditionalTeamOrderShipping(input: {
  rushShipping?: boolean | null;
  localPickup?: boolean | null;
  ship?: TeamOrderShippingChoice;
}): boolean {
  if (input.rushShipping) return false;
  return input.ship ? input.ship !== "pickup" : !input.localPickup;
}
