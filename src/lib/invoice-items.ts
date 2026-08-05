import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { invoiceItems } from "@/db/schema";

/** The item library learns from every invoice sent: each line is upserted by
 *  lowercased name, and the latest description/price wins. Non-fatal - a
 *  library hiccup must never block an invoice. */
export async function learnInvoiceItems(
  lines: { name: string; description?: string; unitPriceCents: number }[],
): Promise<void> {
  const db = getDb();
  for (const l of lines) {
    const name = l.name.trim();
    if (!name) continue;
    try {
      await db
        .insert(invoiceItems)
        .values({ name, nameKey: name.toLowerCase(), description: l.description?.trim() || null, unitPriceCents: l.unitPriceCents })
        .onConflictDoUpdate({
          target: invoiceItems.nameKey,
          set: {
            name,
            // Keep the old description if the new line left it blank.
            description: sql`coalesce(nullif(${l.description?.trim() ?? ""}, ''), ${invoiceItems.description})`,
            unitPriceCents: l.unitPriceCents,
            updatedAt: new Date(),
          },
        });
    } catch (e) {
      console.error("invoice item learn failed:", e);
    }
  }
}
