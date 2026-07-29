import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { orders, orderItems } from "@/db/schema";
import type { RosterEntry } from "@/lib/print-file-verifier";

const SIZES = [
  "Youth Small", "Youth Medium", "Youth Large", "Youth X-Large",
  "Small", "Medium", "Large", "X-Large", "2X-Large", "3X-Large", "4X-Large", "5X-Large",
  "XS", "S/M", "L/XL", "XXL", "One Size",
];

export type ParsedLine = RosterEntry & { design?: string; label: string; groupKey: string; groupLabel: string };

/** Parse a composed store line-item name into a printed-jersey roster entry
 *  with its design group. Returns null for tax lines, hats, or items with no
 *  printed name+number. Format: "<Label> - [Design] - <Size> - <NAME> - #<NUMBER>". */
export function parseStoreLine(name: string): ParsedLine | null {
  if (!name || /tax/i.test(name)) return null;
  const parts = name.split(" - ").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3) return null;
  const last = parts[parts.length - 1];
  const numMatch = last.match(/^#?(\d+)$/);
  if (!numMatch) return null;
  const number = numMatch[1];
  const playerName = parts[parts.length - 2] || "";
  if (!playerName) return null;
  const size = parts.find((p) => SIZES.includes(p)) ?? "";
  const label = parts[0];
  // Design = the middle token that isn't the size or the player name.
  const design = parts.find((p, i) => i > 0 && i < parts.length - 2 && !SIZES.includes(p) && p !== playerName);
  const groupLabel = design ? `${label} — ${design}` : label;
  // Stable key for storing per-group QA state.
  const groupKey = groupLabel.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return { name: playerName, number, size, design, label, groupKey, groupLabel };
}

async function paidLines(teamId: string): Promise<ParsedLine[]> {
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
  return items.map((it) => parseStoreLine(it.name)).filter((x): x is ParsedLine => Boolean(x));
}

/** Design groups in this store's paid add-ons, each its own print-file batch. */
export async function getStoreGroups(teamId: string): Promise<{ key: string; label: string; count: number }[]> {
  const lines = await paidLines(teamId);
  const map = new Map<string, { key: string; label: string; count: number }>();
  for (const l of lines) {
    const g = map.get(l.groupKey) ?? { key: l.groupKey, label: l.groupLabel, count: 0 };
    g.count += 1;
    map.set(l.groupKey, g);
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** Roster (name/number/size) for one design group - what a single print file
 *  should contain. Pass no group to get everything (legacy). */
export async function getStoreRoster(teamId: string, groupKey?: string): Promise<RosterEntry[]> {
  const lines = await paidLines(teamId);
  const filtered = groupKey ? lines.filter((l) => l.groupKey === groupKey) : lines;
  return filtered.map((l) => ({ name: l.name, number: l.number, size: l.size }));
}
