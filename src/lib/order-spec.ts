import {
  JERSEY_MATERIALS,
  itemLabel,
  sizeBreakdown,
} from "@/lib/order-items";
import type { TeamOrderQuote } from "@/lib/team-order-pricing";

export type CustomerOrderSpec = {
  version: 1;
  teamName: string;
  products: string[];
  jerseyStyle: string | null;
  jerseyMaterial: string | null;
  colors: string | null;
  designs: { label: string; image: string }[];
  serviceLevel: "Standard" | "Rush" | "Priority";
  productionWindow: string;
  requestedInHandDate: string | null;
  athleteCount: number;
  pieceCount: number;
  sizes: { label: string; parts: { size: string; quantity: number }[] }[];
  priceLines: { label: string; quantity: number; unitPriceCents: number; totalCents: number }[];
  rushFeeCents: number;
  priorityFeeCents: number;
  merchandiseSubtotalCents: number;
  taxAndShipping: "Calculated separately on the invoice";
};

type SpecOrder = {
  teamName: string;
  items?: string[] | null;
  sport?: string | null;
  jerseyStyle?: string | null;
  jerseyMaterial?: string | null;
  turnaroundTier?: string | null;
  rushShipping?: boolean | null;
  requestedInHandAt?: Date | null;
  approvedDesignUrl?: string | null;
};

type SpecRosterRow = {
  id?: string;
  playerName?: string | null;
  playerNumber?: string | null;
  size?: string | null;
  sizes?: Record<string, string> | null;
  quantity?: number | null;
};

type SpecDesign = {
  colors?: string | null;
  designs?: { label: string; image: string }[] | null;
  neededBy?: Date | null;
};

function dateOnly(value?: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function serviceLevelForOrder(
  order: SpecOrder,
  rushFeeCents?: number,
): Pick<CustomerOrderSpec, "serviceLevel" | "productionWindow"> {
  if (order.turnaroundTier === "priority") {
    return { serviceLevel: "Priority", productionWindow: "1 week after all production requirements are complete; manually approved premium" };
  }
  if (order.turnaroundTier === "rush" || order.rushShipping) {
    const fee = rushFeeCents && rushFeeCents > 0
      ? `$${(rushFeeCents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
      : "$100";
    return { serviceLevel: "Rush", productionWindow: `2 weeks after all production requirements are complete; ${fee} rush fee` };
  }
  return { serviceLevel: "Standard", productionWindow: "3 weeks after approved artwork, final roster, and deposit" };
}

export function buildCustomerOrderSpec(
  order: SpecOrder,
  roster: SpecRosterRow[],
  design: SpecDesign | null | undefined,
  quote: TeamOrderQuote,
): CustomerOrderSpec {
  const items = order.items?.length ? order.items : ["jersey"];
  const material = order.jerseyMaterial
    ? JERSEY_MATERIALS.find((entry) => entry.key === order.jerseyMaterial)?.label ?? order.jerseyMaterial
    : null;
  const athletes = new Set(
    roster.map((row, index) => {
      const name = (row.playerName ?? "").trim().toLowerCase();
      const number = (row.playerNumber ?? "").trim().toLowerCase();
      return name || number ? `${name}|${number}` : row.id ?? `row:${index}`;
    }),
  );
  const service = serviceLevelForOrder(order, quote.rushFeeCents);

  return {
    version: 1,
    teamName: order.teamName,
    products: items.map(itemLabel),
    jerseyStyle: order.jerseyStyle ?? null,
    jerseyMaterial: material,
    colors: design?.colors ?? null,
    designs: (design?.designs?.length
      ? design.designs
      : order.approvedDesignUrl
        ? [{ label: "Approved design", image: order.approvedDesignUrl }]
        : []
    ).map(({ label, image }) => ({ label, image })),
    ...service,
    requestedInHandDate: dateOnly(order.requestedInHandAt ?? design?.neededBy),
    athleteCount: athletes.size,
    pieceCount: roster.reduce((total, row) => total + Math.max(1, row.quantity ?? 1), 0),
    sizes: sizeBreakdown(roster, items, order.sport).map((entry) => ({
      label: entry.label,
      parts: entry.parts.map((part) => ({ size: part.size, quantity: part.n })),
    })),
    priceLines: quote.lines,
    rushFeeCents: quote.rushFeeCents,
    priorityFeeCents: quote.priorityFeeCents,
    merchandiseSubtotalCents: quote.totalCents,
    taxAndShipping: "Calculated separately on the invoice",
  };
}
