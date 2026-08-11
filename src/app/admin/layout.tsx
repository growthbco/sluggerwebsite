import { AdminSidebar } from "@/components/admin-sidebar";

// Every /admin page shares the persistent sidebar (desktop) / pill bar
// (mobile) so the whole back office is reachable from one nav. The login
// page opts out inside AdminSidebar itself.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell flex flex-col lg:flex-row min-h-screen">
      <AdminSidebar />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
