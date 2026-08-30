import { PUBLIC_TIMELINE_COPY } from "@/lib/customer-policy";

// Client-safe (no server imports): default terms & conditions pre-filled on
// every new custom invoice, editable per invoice before sending.
export const STANDARD_INVOICE_TERMS = [
  "All items are custom made to order. Production begins once payment is received.",
  "Please double-check names, numbers, and sizes before paying - items are produced exactly as ordered. Custom and personalized items are non-refundable and non-returnable, except for covered manufacturing defects or production errors. Report any issue within 14 days of delivery and we will review it under our Returns & Exchanges policy.",
  "Colors may vary slightly from on-screen mockups.",
  `${PUBLIC_TIMELINE_COPY} Specialty items may take longer.`,
  "Questions? Reply to the invoice email or text us at (352) 414-7270.",
].join("\n\n");
