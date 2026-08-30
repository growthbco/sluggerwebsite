import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { adminEnabled, canAccess, getAdminSession } from "@/lib/admin-auth";
import { AdminConversations } from "@/components/admin-conversations";

export const metadata: Metadata = {
  title: "Conversations",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

export default async function AdminTextsPage({
  searchParams,
}: {
  searchParams: Promise<{
    to?: string;
    name?: string;
    tab?: string;
    open?: string;
  }>;
}) {
  if (!adminEnabled()) redirect("/admin");
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!canAccess(session.role, "/admin/texts")) redirect("/admin");
  const { to, name, tab, open } = await searchParams;
  // ?open=<designId> deep-links an email thread (from an email alert) and
  // implies the Email tab.
  const initialTab = tab === "email" || open ? "email" : "texts";

  return (
    <div className="mx-auto w-full max-w-[100rem] px-3 py-4 sm:px-5 sm:py-6">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="text-[10px] uppercase tracking-[0.22em] text-muted">
            Customer inbox
          </span>
          <h1 className="display mt-0.5 text-2xl text-foreground sm:text-3xl">
            Conversations
          </h1>
        </div>
        <div className="hidden items-center gap-2 text-xs text-muted sm:flex">
          <span
            className="h-2 w-2 rounded-full bg-emerald-400"
            aria-hidden="true"
          />
          Shop line (352) 414-7270
        </div>
      </header>
      <div>
        <AdminConversations
          initialTab={initialTab}
          initialPhone={to}
          initialName={name}
          initialOpen={open}
        />
      </div>
    </div>
  );
}
