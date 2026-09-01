import type { Metadata } from "next";
import { dbEnabled } from "@/db";
import { getByDesignRequestId, getByManageToken } from "@/lib/team-orders";
import { TeamOrderManageSection } from "@/components/team-order-manage-section";
import { getAdminSession } from "@/lib/admin-auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Manage Team Order", robots: { index: false } };

export default async function ManagePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await getAdminSession();
  if (session?.role === "designer") redirect("/admin/team-orders");

  if (!dbEnabled()) {
    return <Centered title="Not available yet">Team orders aren&apos;t turned on yet.</Centered>;
  }

  const order = await getByManageToken(token);
  if (!order) {
    return <Centered title="Link not found">This management link is invalid or has expired.</Centered>;
  }

  // Older approval/order flows could leave a cancelled duplicate's customer
  // link in an email or text. Never render that obsolete order: send the coach
  // to the active order for the same design so its real products and size
  // fields are shown (for example, cheer top + skirt instead of Jersey).
  if (order.status === "cancelled" && order.designRequestId) {
    const current = await getByDesignRequestId(order.designRequestId);
    if (current && current.id !== order.id && current.status !== "cancelled" && current.manageToken) {
      redirect(`/team-order/manage/${current.manageToken}`);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-12">
      <TeamOrderManageSection order={order} />
    </div>
  );
}

function Centered({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 py-24 text-center">
      <h1 className="display text-3xl text-foreground">{title}</h1>
      <p className="mt-3 text-muted">{children}</p>
    </div>
  );
}
