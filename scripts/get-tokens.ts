// Dev helper: print the tokens for a given design request reference.
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { getDb } from "../src/db";
import { designRequests } from "../src/db/schema";
import { eq } from "drizzle-orm";

const ref = process.argv[2];
if (!ref) {
  console.error("usage: tsx scripts/get-tokens.ts <REFERENCE>");
  process.exit(1);
}

async function main() {
  const db = getDb();
  const [r] = await db.select().from(designRequests).where(eq(designRequests.reference, ref)).limit(1);
  if (!r) {
    console.log("not found");
    process.exit(1);
  }
  console.log(JSON.stringify({
    id: r.id,
    statusToken: r.statusToken,
    manageToken: r.manageToken,
    discordThreadId: r.discordThreadId,
    status: r.status,
    revisionsUsed: r.revisionsUsed,
    proofImages: r.proofImages,
  }, null, 2));
}
main();
