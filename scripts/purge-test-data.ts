// Delete test design requests + team orders created during the build session.
// We match on the team_name patterns we used (not on contact email, since
// hello@growthbco.com is also the owner's real address).
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { getDb } from "../src/db";
import { designRequests, teamOrders, teamOrderRoster } from "../src/db/schema";
import { inArray, eq } from "drizzle-orm";

// Team names we generated while testing. Real customer team names will not
// match any of these.
const TEST_TEAM_NAMES = [
  "Thread Test",
  "Full Flow QA",
  "Cap Test",
  "Free Agents (Print QA Test)",
  "Canonical Team",
  "Tampered Team",
  "Tampered Team 2",
  "Brand New Team",
  "Returning Team",
];

async function main() {
  const db = getDb();

  // 1. Find matching design requests
  const designs = await db
    .select({ id: designRequests.id, reference: designRequests.reference, teamName: designRequests.teamName })
    .from(designRequests)
    .where(inArray(designRequests.teamName, TEST_TEAM_NAMES));

  // 2. Find matching team orders (by team name OR linked to a test design)
  const designIds = designs.map((d) => d.id);
  const orders = await db
    .select({ id: teamOrders.id, reference: teamOrders.reference, teamName: teamOrders.teamName })
    .from(teamOrders)
    .where(inArray(teamOrders.teamName, TEST_TEAM_NAMES));
  const linkedOrders = designIds.length
    ? await db
        .select({ id: teamOrders.id, reference: teamOrders.reference, teamName: teamOrders.teamName })
        .from(teamOrders)
        .where(inArray(teamOrders.designRequestId, designIds))
    : [];
  const allOrderIds = Array.from(new Set([...orders, ...linkedOrders].map((o) => o.id)));
  const allOrderRefs = Array.from(new Set([...orders, ...linkedOrders].map((o) => `${o.reference} (${o.teamName})`)));

  console.log("Will delete:");
  console.log(`  ${designs.length} design requests:`);
  for (const d of designs) console.log(`    - ${d.reference}  ${d.teamName}`);
  console.log(`  ${allOrderIds.length} team orders:`);
  for (const r of allOrderRefs) console.log(`    - ${r}`);

  if (designs.length === 0 && allOrderIds.length === 0) {
    console.log("Nothing to purge.");
    return;
  }

  // 3. Delete in dependency order: roster → team orders → designs
  if (allOrderIds.length) {
    await db.delete(teamOrderRoster).where(inArray(teamOrderRoster.teamOrderId, allOrderIds));
    await db.delete(teamOrders).where(inArray(teamOrders.id, allOrderIds));
  }
  if (designIds.length) {
    await db.delete(designRequests).where(inArray(designRequests.id, designIds));
  }
  console.log("\n✓ purged");
}
main().catch((e) => { console.error(e); process.exit(1); });
