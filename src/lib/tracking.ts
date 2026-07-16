// Pure, client-safe tracking helpers (no server imports) so both the admin UI
// and the server fulfillment code can build carrier links the same way.

/** Best-guess carrier from the tracking number format. */
export function carrierFor(num: string): "UPS" | "USPS" | "FedEx" {
  const n = (num ?? "").replace(/\s/g, "");
  if (/^1Z/i.test(n)) return "UPS";
  // FedEx: 12 or 15 all-digit numbers (USPS numbers are longer, 20-22 digits).
  if (/^\d{12}$/.test(n) || /^\d{15}$/.test(n)) return "FedEx";
  return "USPS";
}

/** Direct "track this package" URL on the carrier's own site. */
export function trackingUrlFor(num: string): string {
  const n = (num ?? "").replace(/\s/g, "");
  switch (carrierFor(n)) {
    case "UPS":
      return `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}`;
    case "FedEx":
      return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}`;
    default:
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(n)}`;
  }
}
