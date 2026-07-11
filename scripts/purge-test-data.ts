// Delete test design requests + team orders created during the build session.
// We match on the team_name patterns we used (not on contact email, since
// hello@growthbco.com is also the owner's real address).
//
// SAFETY: some of these names ("Slugger Athletics", "Test Team", "Sandstorm")
// are plausible real customer team names, so two guards apply:
//   1. Only rows created before CREATED_BEFORE are eligible (all test data
//      predates this date; update it if you add newer test names).
//   2. The script is a dry run unless invoked with --yes:
//        npx tsx scripts/purge-test-data.ts --yes
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { getDb } from "../src/db";
import { designRequests, teamOrders, teamOrderRoster } from "../src/db/schema";
import { inArray, and, lt } from "drizzle-orm";

const CREATED_BEFORE = new Date("2026-07-11T00:00:00Z");
const CONFIRMED = process.argv.includes("--yes");

// Team names we generated while testing.
const TEST_TEAM_NAMES = [
  // This-session QA
  "Thread Test",
  "Full Flow QA",
  "Cap Test",
  "Free Agents (Print QA Test)",
  "Canonical Team",
  "Tampered Team",
  "Tampered Team 2",
  "Brand New Team",
  "Returning Team",
  // Earlier sessions (owner's own pre-launch tests)
  "Slugger Athletics", // designs typed using the company's own name
  "Test Team",
  "Rush Test Team",
  "Forum Test Team",
  "Knicks in Da Finals",
  "Knicks in 3.5",
  "Sandstorm", // team orders from coach@example.com / c@x.com
];

async function main() {
  const db = getDb();

  // 1. Find matching design requests
  const designs = await db
    .select({ id: designRequests.id, reference: designRequests.reference, teamName: designRequests.teamName })
    .from(designRequests)
    .where(and(inArray(designRequests.teamName, TEST_TEAM_NAMES), lt(designRequests.createdAt, CREATED_BEFORE)));

  // 2. Find matching team orders (by team name OR linked to a test design)
  const designIds = designs.map((d) => d.id);
  const orders = await db
    .select({ id: teamOrders.id, reference: teamOrders.reference, teamName: teamOrders.teamName })
    .from(teamOrders)
    .where(and(inArray(teamOrders.teamName, TEST_TEAM_NAMES), lt(teamOrders.createdAt, CREATED_BEFORE)));
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

  if (!CONFIRMED) {
    console.log("\nDry run - nothing deleted. Re-run with --yes to delete the rows above.");
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
