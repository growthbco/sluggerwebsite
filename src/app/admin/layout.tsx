import type { Metadata } from "next";
import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminDialer } from "@/components/admin-dialer";
import { AdminNotifier } from "@/components/admin-notifier";
import { getAdminSession } from "@/lib/admin-auth";

// Belt-and-suspenders with robots.ts: every /admin route is noindex at the
// layout level, so the whole back office (current + any future page) stays
// out of search results even if a page forgets its own robots metadata.
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Every /admin page shares the persistent sidebar (desktop) / pill bar
// (mobile). The sidebar filters itself by the logged-in user's role; the
// login page opts out inside AdminSidebar itself.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  return (
    <div className="admin-shell flex flex-col lg:flex-row min-h-screen">
      <AdminSidebar role={session?.role ?? "staff"} userName={session?.name} />
      {/* Bottom clearance so the floating dialer (fixed bottom-right) never sits
          on top of a table's last row / row actions. */}
      <div className="flex-1 min-w-0 pb-24">{children}</div>
      {session && session.role !== "designer" && <AdminDialer />}
      {session && <AdminNotifier />}
    </div>
  );
}
