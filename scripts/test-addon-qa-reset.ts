/**
 * One-off test: paid add-on must reset print-file QA.
 *
 * Simulates the full lifecycle on a clearly-labeled TEST order:
 *   1. Create a team order + roster, submit it.
 *   2. Mark its print file as verified (the "already approved" state).
 *   3. Create a 3-jersey add-on and run markAddonPaid - the exact function
 *      the Stripe webhook calls when an add-on payment lands.
 *   4. Assert: rows appended to roster, printFileVerifiedAt and
 *      printFileVerification are cleared.
 *   5. Delete all test rows.
 *
 * Run:  npx tsx scripts/test-addon-qa-reset.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { eq } from "drizzle-orm";

async function main() {
  const { getDb } = await import("../src/db");
  const { teamOrders, teamOrderRoster, teamOrderAddons } = await import("../src/db/schema");
  const { createTeamOrder, addRosterRow, submitTeamOrder, getRoster, savePrintFileVerification } =
    await import("../src/lib/team-orders");
  const { priceAddonRows, createAddon, markAddonPaid } = await import("../src/lib/team-order-addons");

  const db = getDb();
  let orderId: string | null = null;
  let pass = true;
  const check = (label: string, ok: boolean, detail?: string) => {
    console.log(`${ok ? "  ✅" : "  ❌"} ${label}${detail ? ` - ${detail}` : ""}`);
    if (!ok) pass = false;
  };

  try {
    // 1. Fake order in the "already approved and verified" state.
    console.log("\n1) Creating TEST order...");
    const created = await createTeamOrder({
      teamName: "ZZZ TEST DO NOT PRODUCE",
      contactName: "QA Test",
      contactEmail: "hello@growthbco.com",
      jerseyStyle: "crew",
      items: ["jersey"],
    });
    orderId = created.id;
    console.log(`   ${created.reference} (${orderId})`);

    await addRosterRow(orderId, { playerName: "SMITH", playerNumber: "1", sizes: { jersey: "M" } }, "test");
    await addRosterRow(orderId, { playerName: "JONES", playerNumber: "2", sizes: { jersey: "L" } }, "test");
    await submitTeamOrder(orderId);

    console.log("2) Marking print file as verified (pre-add-on state)...");
    await savePrintFileVerification(orderId, ["https://example.com/fake-print-file.png"], {
      ok: true,
      summary: "All 2 roster players match the print file (2 jerseys printed).",
      extracted: [
        { name: "SMITH", number: "1", size: "M" },
        { name: "JONES", number: "2", size: "L" },
      ],
      mismatches: [],
      verifiedAt: new Date().toISOString(),
      model: "test",
    });
    const [before] = await db.select().from(teamOrders).where(eq(teamOrders.id, orderId)).limit(1);
    check("precondition: print file shows VERIFIED", Boolean(before.printFileVerifiedAt));

    // 3. Add-on of 3 jerseys, then the webhook's paid handler.
    console.log("3) Creating 3-jersey add-on and marking it paid (webhook path)...");
    const { rows, totalCents } = priceAddonRows(before, [
      { key: "jersey", size: "M", name: "GARCIA", number: "7", quantity: 1 },
      { key: "jersey", size: "L", name: "LEE", number: "12", quantity: 1 },
      { key: "jersey", size: "XL", name: "BROWN", number: "23", quantity: 1 },
    ]);
    check("add-on priced", rows.length === 3 && totalCents > 0, `${rows.length} rows, $${(totalCents / 100).toFixed(2)}`);
    const addon = await createAddon(orderId, rows, totalCents);
    const result = await markAddonPaid(addon.id, "cs_test_fake_session_qa", totalCents);
    check("markAddonPaid returned a result", Boolean(result));

    // 4. Assertions.
    console.log("4) Verifying outcome...");
    const roster = await getRoster(orderId);
    const addonRows = roster.filter((r) => r.filledBy === "addon");
    check("roster grew 2 -> 5", roster.length === 5, `now ${roster.length} rows`);
    check(
      "3 add-on rows tagged PAID ADD-ON",
      addonRows.length === 3 && addonRows.every((r) => r.notes === "PAID ADD-ON"),
      addonRows.map((r) => `${r.playerName} #${r.playerNumber}`).join(", "),
    );
    const [after] = await db.select().from(teamOrders).where(eq(teamOrders.id, orderId)).limit(1);
    check("printFileVerifiedAt cleared", after.printFileVerifiedAt === null);
    check("printFileVerification cleared", after.printFileVerification === null);
    check("old print-file URLs kept for re-check", (after.printFileUrls?.length ?? 0) === 1);

    const [paidAddon] = await db.select().from(teamOrderAddons).where(eq(teamOrderAddons.id, addon.id)).limit(1);
    check("add-on marked paid", paidAddon.status === "paid");
  } finally {
    // 5. Cleanup - remove every test row.
    if (orderId) {
      console.log("5) Cleaning up test rows...");
      await db.delete(teamOrderRoster).where(eq(teamOrderRoster.teamOrderId, orderId));
      await db.delete(teamOrderAddons).where(eq(teamOrderAddons.teamOrderId, orderId));
      await db.delete(teamOrders).where(eq(teamOrders.id, orderId));
      console.log("   done - no trace left in the database.");
    }
  }

  console.log(pass ? "\nRESULT: PASS ✅\n" : "\nRESULT: FAIL ❌\n");
  if (!pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
