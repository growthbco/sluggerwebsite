// End-to-end test of the print-file QA: upload the FREE AGENTS print file,
// build a roster that matches it, then hit the live verify endpoint.
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { readFileSync } from "node:fs";
import { put } from "@vercel/blob";

const IMG = process.argv[2] || "/Users/garysanchez/.claude/image-cache/2970f2ae-2152-46e5-99c0-ddd4dd71fbd7/23.png";
const SITE = "https://sluggerathletics.com";

// Ground-truth roster as printed on the FREE AGENTS layout.
// Sizes use the verifier's canonical form.
type R = { name: string; number: string; size: string };
const PRINTED_ROSTER: R[] = [
  { name: "CROZZY",      number: "67", size: "6T" },
  { name: "CROZZY",      number: "67", size: "6T" },
  { name: "HOMEY BYNER", number: "23", size: "3T" },
  { name: "REYES",       number: "21", size: "S" },
  { name: "ROXY",        number: "12", size: "S" },
  { name: "MENDEZ",      number: "5",  size: "M" },
  { name: "BARNER",      number: "7",  size: "M" },
  { name: "BOTT",        number: "20", size: "M" },
  { name: "ST. NICK",    number: "23", size: "M" },
  { name: "MAMA",        number: "23", size: "L" },
  { name: "CROZZY",      number: "67", size: "L" },
  { name: "REY",         number: "21", size: "L" },
  { name: "CROZZY",      number: "67", size: "L" },
  { name: "LEGETTE",     number: "69", size: "XL" },
  { name: "SPEIGHTS",    number: "31", size: "2XL" },
];

async function main() {
  // 1. Upload the print file to Blob (server-side, uses BLOB_READ_WRITE_TOKEN).
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN missing");
  const bytes = readFileSync(IMG);
  const blob = await put(`print-files/free-agents-test-${Date.now()}.png`, bytes, {
    access: "public",
    contentType: "image/png",
    addRandomSuffix: true,
  });
  console.log("✓ uploaded print file:", blob.url);

  // 2. Create a fresh design request → team order linked to it.
  const dr = await fetch(`${SITE}/api/design-request/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      teamName: "Free Agents (Print QA Test)",
      contactName: "QA",
      contactEmail: "hello@growthbco.com",
      vision: "QA pass for the print-file verifier.",
    }),
  }).then((r) => r.json());
  console.log("✓ design request:", dr.reference);

  // Need the statusToken (private) to link the team order — fetch from DB.
  const { getDb } = await import("../src/db");
  const { designRequests } = await import("../src/db/schema");
  const { eq } = await import("drizzle-orm");
  const db = getDb();
  const [d] = await db.select().from(designRequests).where(eq(designRequests.reference, dr.reference)).limit(1);

  const to = await fetch(`${SITE}/api/team-order/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      teamName: "Free Agents (Print QA Test)",
      contactName: "QA",
      contactEmail: "hello@growthbco.com",
      jerseyStyle: "Tank",
      items: ["jersey"],
      designToken: d.statusToken,
    }),
  }).then((r) => r.json());
  console.log("✓ team order:", to.reference, "→", to.manageUrl);

  // 3. Add roster entries via the self-entry token (the join URL's token).
  const joinToken = to.shareUrl.split("/").pop()!;
  for (const r of PRINTED_ROSTER) {
    const res = await fetch(`${SITE}/api/team-order/${joinToken}/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerName: r.name,
        playerNumber: r.number,
        sizes: { jersey: r.size },
      }),
    });
    if (!res.ok) console.error("  ✗ failed to add", r, await res.text());
  }
  console.log(`✓ added ${PRINTED_ROSTER.length} roster entries`);

  // 4. Run the verify endpoint (authed by the team-order manage token).
  const manageToken = to.manageUrl.split("/").pop()!;
  console.log("⏳ calling Gemini... (this can take 10–30s)");
  const t0 = Date.now();
  const verify = await fetch(`${SITE}/api/team-order/${manageToken}/verify-print-file`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ printFileUrl: blob.url }),
  });
  const data = await verify.json();
  const ms = Date.now() - t0;
  console.log(`✓ verify returned in ${ms}ms\n`);

  if (!data.result) { console.log("ERROR:", data); return; }

  const r = data.result;
  console.log("--- RESULT ---");
  console.log("ok      :", r.ok ? "✅ true (all good)" : "⚠️  false");
  console.log("summary :", r.summary);
  console.log("model   :", r.model);
  console.log(`extracted: ${r.extracted.length} jerseys`);
  for (const j of r.extracted) console.log(`   - ${j.name.padEnd(14)} #${j.number.padEnd(3)} ${j.size}`);
  if (r.mismatches.length) {
    console.log(`\nmismatches: ${r.mismatches.length}`);
    for (const m of r.mismatches) console.log(`   - [${m.kind}] ${m.detail}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
