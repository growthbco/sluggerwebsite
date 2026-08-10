// Client-safe (no server imports): default terms & conditions pre-filled on
// every new custom invoice, editable per invoice before sending.
export const STANDARD_INVOICE_TERMS = [
  "All items are custom made to order. Production begins once payment is received.",
  "Please double-check names, numbers, and sizes before paying - items are produced exactly as ordered. Custom and personalized items are non-refundable and non-returnable, except for manufacturing defects. Report any issue within 7 days of delivery and we will make it right.",
  "Colors may vary slightly from on-screen mockups.",
  "Typical production time is 2-3 weeks after payment/design approval, plus shipping. Specialty items may add a few days.",
  "Questions? Reply to the invoice email or text us at (352) 414-7270.",
].join("\n\n");
