import { AdminSidebar } from "@/components/admin-sidebar";
import { getAdminSession } from "@/lib/admin-auth";

// Every /admin page shares the persistent sidebar (desktop) / pill bar
// (mobile). The sidebar filters itself by the logged-in user's role; the
// login page opts out inside AdminSidebar itself.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  return (
    <div className="admin-shell flex flex-col lg:flex-row min-h-screen">
      <AdminSidebar role={session?.role ?? "staff"} userName={session?.name} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
