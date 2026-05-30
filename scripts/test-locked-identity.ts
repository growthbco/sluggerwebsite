// Verify that a designToken-linked team order ignores any tampered
// teamName/contactName/contactEmail in the request body — those fields
// must come from the design.
import { config } from "dotenv";
config({ path: ".env.local", override: true });

const SITE = "https://sluggerathletics.com";

async function main() {
  const { getDb } = await import("../src/db");
  const { designRequests, teamOrders } = await import("../src/db/schema");
  const { eq } = await import("drizzle-orm");
  const db = getDb();

  // 1. Create an approved design with a known team name.
  const dr = await fetch(`${SITE}/api/design-request/create`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      teamName: "Canonical Team",
      contactName: "Real Coach",
      contactEmail: "hello@growthbco.com",
      vision: "lock-test",
    }),
  }).then((r) => r.json());
  console.log("✓ design:", dr.reference);
  const [d] = await db.select().from(designRequests).where(eq(designRequests.reference, dr.reference)).limit(1);
  // Drop a proof and approve to flip status to approved.
  await fetch(`${SITE}/api/design-request/${d.manageToken}/proof`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls: ["https://wnbdipjkyfozqxrj.public.blob.vercel-storage.com/design-proofs/Coed%20Jersey%20Logo%20%282%29%20%281%29-ZTPd6dveUqxHOWdMcZja5PvXlI62Cp.jpeg"] }),
  });
  await fetch(`${SITE}/api/design-request/${d.statusToken}/approve`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
  });

  // 2. Submit a team order via the create endpoint with a TAMPERED team name + email.
  const to = await fetch(`${SITE}/api/team-order/create`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      teamName: "Tampered Team",          // ← attacker-supplied
      contactName: "Wrong Person",        // ← attacker-supplied
      contactEmail: "attacker@evil.com",  // ← attacker-supplied
      designToken: d.statusToken,
    }),
  }).then((r) => r.json());
  console.log("✓ team order (create):", to.reference);

  // 3. Pull the team order from DB and assert identity came from the design.
  const [order] = await db.select().from(teamOrders).where(eq(teamOrders.reference, to.reference)).limit(1);
  const pass = order.teamName === "Canonical Team"
    && order.contactName === "Real Coach"
    && order.contactEmail === "hello@growthbco.com";
  console.log("\n--- /create endpoint ---");
  console.log("  saved teamName    :", order.teamName, pass ? "✓" : "✗ tamper got through");
  console.log("  saved contactName :", order.contactName);
  console.log("  saved contactEmail:", order.contactEmail);

  // 4. Same test via the manual-submit endpoint.
  const to2 = await fetch(`${SITE}/api/team-order`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      teamName: "Tampered Team 2",
      contactName: "Wrong Person 2",
      contactEmail: "attacker2@evil.com",
      roster: [{ name: "TEST", number: "1", sizes: { jersey: "L" } }],
      designToken: d.statusToken,
    }),
  }).then((r) => r.json());
  console.log("\n--- /api/team-order (manual submit) ---");
  console.log("  ref:", to2.reference, "notified:", to2.notified);
  // For the manual route the data goes to Discord — we can't introspect it from
  // the DB (manual submit doesn't persist), but the server log + Discord post
  // should show 'Canonical Team' not 'Tampered Team 2'.
  console.log("  (manual-submit doesn't persist to DB; check the Discord post for 'Canonical Team')");

  if (!pass) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
