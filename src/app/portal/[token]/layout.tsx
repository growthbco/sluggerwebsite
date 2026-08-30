import { readPortalToken, getCustomerOrdersCached } from "@/lib/portal";
import { PortalShell } from "@/components/portal-shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Wraps every portal section (Orders / Address / Help / an order) in the portal
// shell. An expired/invalid token renders the child full-width (its own message).
export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const email = readPortalToken(token);
  if (!email) return <>{children}</>;

  const data = await getCustomerOrdersCached(email);
  // One team label, case-insensitive, preferring a non-all-caps spelling.
  const labels = new Map<string, string>();
  for (const o of data.teamOrders) {
    if (o.status === "cancelled") continue;
    const k = o.teamName.trim().toLowerCase();
    const cur = labels.get(k);
    labels.set(k, cur && cur === cur.toUpperCase() && o.teamName.trim() !== o.teamName.trim().toUpperCase() ? o.teamName.trim() : cur ?? o.teamName.trim());
  }
  const teamLabel = [...labels.values()][0] ?? "";
  const orderCount = data.teamOrders.filter((o) => o.status !== "cancelled").length
    + data.shop.filter((o) => !["cancelled", "refunded"].includes(o.status)).length;

  return (
    <PortalShell token={token} teamLabel={teamLabel} name={data.name?.trim() || email} orderCount={orderCount}>
      {children}
    </PortalShell>
  );
}
