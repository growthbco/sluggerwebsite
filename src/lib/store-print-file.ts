import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { orders, orderItems } from "@/db/schema";
import type { RosterEntry } from "@/lib/print-file-verifier";

const SIZES = [
  "Youth Small", "Youth Medium", "Youth Large", "Youth X-Large",
  "Small", "Medium", "Large", "X-Large", "2X-Large", "3X-Large", "4X-Large", "5X-Large",
  "XS", "S/M", "L/XL", "XXL", "One Size",
];

/** Parse a composed store line-item name into a printed-jersey roster entry.
 *  Returns null for tax lines, hats, or items with no printed name+number.
 *  Format: "<Label> - [Design] - <Size> - <NAME> - #<NUMBER>". */
export function parseStoreLine(name: string): (RosterEntry & { design?: string; label: string }) | null {
  if (!name || /tax/i.test(name)) return null;
  const parts = name.split(" - ").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3) return null;
  const last = parts[parts.length - 1];
  const numMatch = last.match(/^#?(\d+)$/);
  if (!numMatch) return null; // no number => not a printed name/number jersey
  const number = numMatch[1];
  const playerName = parts[parts.length - 2] || "";
  if (!playerName) return null;
  const size = parts.find((p) => SIZES.includes(p)) ?? "";
  const label = parts[0];
  const design = parts.find((p, i) => i > 0 && i < parts.length - 2 && !SIZES.includes(p) && p !== playerName);
  return { name: playerName, number, size, design, label };
}

/** Build the print-file "roster" for a store from every paid add-on order:
 *  one entry per printed jersey (name + number + size). */
export async function getStoreRoster(teamId: string): Promise<RosterEntry[]> {
  const db = getDb();
  const paid = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.teamId, teamId), inArray(orders.status, ["paid", "fulfilled"])));
  if (paid.length === 0) return [];
  const items = await db
    .select({ name: orderItems.name })
    .from(orderItems)
    .where(inArray(orderItems.orderId, paid.map((o) => o.id)));
  const roster: RosterEntry[] = [];
  for (const it of items) {
    const parsed = parseStoreLine(it.name);
    if (parsed) roster.push({ name: parsed.name, number: parsed.number, size: parsed.size });
  }
  return roster;
}
