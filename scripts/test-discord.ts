// One-off: posts a sample order to the #orders channel to verify the webhook.
import { config } from "dotenv";
config({ path: ".env.local" });
import { postOrderToDiscord } from "../src/lib/discord";

async function main() {
  const ok = await postOrderToDiscord({
    reference: "SA-TEST0002",
    orderType: "Buy-In",
    threadName: "Starbucks & Stanleys",
    customerName: "TEST ORDER (ignore)",
    customerEmail: "test@sluggerathletics.com",
    shipping: "123 Main St\nGainesville, FL 32601\nUS",
    lines: [
      { name: "Starbucks & Stanleys", description: "Size: Large · Player Name: SMITH · Number: 23", quantity: 1, amountCents: 5500 },
    ],
    totalCents: 5500,
  });
  console.log(ok ? "✓ Posted test order to Discord" : "✗ Failed to post");
}

main();
