import assert from "node:assert/strict";
import { renderTeamOrderInvoice } from "../src/lib/email";
import { shouldChargeAdditionalTeamOrderShipping } from "../src/lib/team-order-shipping";

const cases: Array<{
  name: string;
  input: Parameters<typeof shouldChargeAdditionalTeamOrderShipping>[0];
  expected: boolean;
}> = [
  { name: "Rush direct shipping is included", input: { rushShipping: true }, expected: false },
  { name: "Rush ignores an explicit auto-shipping choice", input: { rushShipping: true, ship: "auto" }, expected: false },
  { name: "Rush remains included when pickup was not selected", input: { rushShipping: true, localPickup: false }, expected: false },
  { name: "Standard shipped orders pay shipping", input: { rushShipping: false, localPickup: false }, expected: true },
  { name: "Standard local pickup is free", input: { rushShipping: false, localPickup: true }, expected: false },
  { name: "Explicit pickup makes a standard invoice free", input: { rushShipping: false, ship: "pickup" }, expected: false },
  { name: "Explicit auto shipping overrides a prior standard pickup choice", input: { rushShipping: false, localPickup: true, ship: "auto" }, expected: true },
];

for (const testCase of cases) {
  assert.equal(shouldChargeAdditionalTeamOrderShipping(testCase.input), testCase.expected, testCase.name);
}

const rushInvoice = renderTeamOrderInvoice({
  teamName: "Test Team",
  reference: "TEST-1",
  stage: "full",
  lines: [],
  totalCents: 10_000,
  dueCents: 10_000,
  taxDueCents: 700,
  shipCents: 0,
  payUrl: "https://example.com/pay",
  shippingIncludedWithRush: true,
});
assert.match(rushInvoice.html, /included with Rush/i);
assert.match(rushInvoice.html, /No additional shipping charge/i);
assert.doesNotMatch(rushInvoice.html, /added to your final invoice/i);
assert.match(rushInvoice.subject, /Rush order/i);
assert.match(rushInvoice.html, /paid in full/i);
assert.match(rushInvoice.html, /no remaining balance/i);
assert.doesNotMatch(rushInvoice.html, /50% deposit/i);

console.log(`Passed ${cases.length + 7} Rush/direct-shipping billing checks.`);
