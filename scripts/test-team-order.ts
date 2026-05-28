// One-off: posts a sample roster to the #team-orders channel to verify the webhook.
import { config } from "dotenv";
config({ path: ".env.local" });
import { postTeamOrderToDiscord } from "../src/lib/discord";

async function main() {
  const ok = await postTeamOrderToDiscord({
    reference: "TO-TEST01",
    teamName: "TEST TEAM (ignore)",
    contactName: "Coach Mike",
    contactEmail: "coach@example.com",
    contactPhone: "(352) 660-1232",
    jerseyStyle: "V-Neck",
    roster: [
      { name: "Smith", number: "23", size: "Large" },
      { name: "Jones", number: "7", size: "Medium", notes: "long sleeve" },
      { name: "Garcia", number: "11", size: "Youth Large" },
    ],
  });
  console.log(ok ? "✓ Posted test team order to Discord" : "✗ Failed to post");
}

main();
