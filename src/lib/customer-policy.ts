/**
 * Customer-facing commercial facts.
 *
 * Keep this module client-safe. Public pages, forms, email templates, invoices,
 * and the customer portal all import it so the site cannot promise different
 * timelines or describe production differently from page to page.
 */
export const STANDARD_PRODUCTION_DAYS = 21;
export const RUSH_PRODUCTION_DAYS = 14;
export const PRIORITY_PRODUCTION_DAYS = 7;
export const RUSH_FEE_CENTS = 10_000;
export const LARGE_ORDER_RUSH_FEE_CENTS = 15_000;
export const LARGE_ORDER_RUSH_PIECES = 50;
export const RUSH_PRICE_COPY = "$100 for 1–49 pieces; $150 for 50+ pieces";
export const SHIPPING_BUFFER_DAYS = 5;
export const CLAIM_REPORT_WINDOW_DAYS = 7;

export const PRODUCTION_CLOCK_REQUIREMENTS =
  "final proof approval, final roster submission, and deposit payment";

export const STANDARD_PRODUCTION_COPY =
  "Standard production is 3 weeks after final proof approval, final roster submission, and deposit payment.";

export const RUSH_PRODUCTION_COPY =
  `For full team orders only, confirmed 2-week Rush production with shipping included is ${RUSH_PRICE_COPY}. No additional shipping charge. Rush is not available for individual team-store purchases.`;

export const PRIORITY_PRODUCTION_COPY =
  "Deadlines inside 2 weeks require a separately priced Priority review and are never automatic.";

export const SHIPPING_TIMING_COPY =
  "Carrier transit follows production and delivery dates are estimates. Standard shipping is calculated separately; Rush includes shipping.";

export const PUBLIC_TIMELINE_COPY = `${STANDARD_PRODUCTION_COPY} ${RUSH_PRODUCTION_COPY} ${PRIORITY_PRODUCTION_COPY} ${SHIPPING_TIMING_COPY}`;

export const MANUFACTURING_COPY =
  "Designed and quality-checked by Slugger Athletics in Ocala, with in-house embroidery and trusted production partners for custom sublimated uniforms.";

export const SHIPPING_CARRIER_COPY =
  "We select from major carriers such as UPS, USPS, FedEx, and DHL based on the shipment, destination, price, and confirmed timeline.";

/** The reporting clock begins at carrier-recorded delivery or the recorded
 * local-pickup handoff. Multi-package orders pass the final delivery time. */
export function claimDeadlineFromDelivery(deliveredAt: Date | string): Date {
  return new Date(new Date(deliveredAt).getTime() + CLAIM_REPORT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

export function formatCustomerDate(value: Date | string): string {
  return new Date(value).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function moneyFromCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
