"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { AdminIcon } from "@/components/admin-icons";

// The persistent admin nav: one place to reach everything, grouped the way
// the work actually flows. Page items highlight when you're on them.
const GROUPS: { title: string; items: { href: string; label: string; icon: string; designerOnly?: boolean }[] }[] = [
  {
    title: "Menu",
    items: [
      { href: "/admin", label: "Dashboard", icon: "grid" },
      { href: "/admin/follow-ups", label: "Call Queue", icon: "phone" },
      { href: "/admin/texts", label: "Conversations", icon: "chat" },
      { href: "/admin/calls", label: "Calls", icon: "phone" },
      { href: "/admin/customers", label: "Customers", icon: "users" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/admin/design-requests", label: "Design Requests", icon: "pen" },
      { href: "/admin/team-orders", label: "Team Orders", icon: "box" },
      { href: "/admin/designer-tracking", label: "Production Tracking", icon: "truck", designerOnly: true },
      { href: "/admin/design-lab", label: "Design Lab Leads", icon: "flask" },
      { href: "/admin/stores", label: "Team Stores", icon: "store" },
      { href: "/admin/shop-orders", label: "Shop Orders", icon: "cart" },
      { href: "/admin/pickup", label: "Schedule Pickup", icon: "truck" },
    ],
  },
  {
    title: "Financials",
    items: [
      { href: "/admin/invoice/new", label: "New Invoice", icon: "invoice" },
      { href: "/admin/invoices", label: "Designer Invoices", icon: "receipt" },
      { href: "/admin/designer-invoices", label: "My Invoices", icon: "receipt", designerOnly: true },
      { href: "/admin/awaiting-payment", label: "Awaiting Payment", icon: "clock" },
      { href: "/admin/payments", label: "Transactions", icon: "swap" },
    ],
  },
  {
    title: "Settings",
    items: [
      { href: "/admin/assistant", label: "AI Assistant", icon: "sparkle" },
      { href: "/admin/settings", label: "Users & Settings", icon: "gear" },
    ],
  },
];

// What a designer's sidebar shows: conversations, job artwork, production,
// tracking, and their own invoices. Broader CRM, calls, leads, and money stay
// out.
const DESIGNER_HREFS = new Set([
  "/admin",
  "/admin/texts",
  "/admin/design-requests",
  "/admin/team-orders",
  "/admin/designer-tracking",
  "/admin/designer-invoices",
]);
const FOLLOW_UP_HREFS = new Set(["/admin/follow-ups"]);
const OWNER_ONLY_HREFS = new Set(["/admin/settings"]);

export function AdminSidebar({ role = "staff", userName }: { role?: "owner" | "staff" | "designer" | "follow_up"; userName?: string }) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  // The login page gets no chrome; everything else under /admin does.
  if (pathname === "/admin/login") return null;

  const visible = (href: string) => {
    if (OWNER_ONLY_HREFS.has(href)) return role === "owner";
    if (role === "designer") return DESIGNER_HREFS.has(href);
    if (role === "follow_up") return FOLLOW_UP_HREFS.has(href);
    return true;
  };
  const groups = GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((it) => (role === "designer" ? visible(it.href) : !it.designerOnly && visible(it.href))),
  })).filter((g) => g.items.length > 0);

  const isActive = (href: string) => !href.includes("#") && pathname === href;
  const initial = (userName?.trim()?.[0] ?? "S").toUpperCase();
  const allItems = groups.flatMap((g) => g.items);
  const currentLabel = allItems.find((it) => isActive(it.href))?.label ?? "Admin";

  return (
    <>
      {/* Desktop: fixed left rail - pinned to the viewport so it never scrolls
          with the page. The outer nav is just a width spacer. */}
      <nav className="hidden lg:block w-52 shrink-0">
        <div className="fixed inset-y-0 left-0 z-30 w-52 flex flex-col border-r border-line bg-steel/95 backdrop-blur">
          <Link href="/admin" className="flex items-center h-16 px-5 shrink-0">
            <Image src="/slugger-logo.png" alt="Slugger Athletics" width={120} height={72} className="h-12 w-auto" />
          </Link>

          <div className="mx-4 mb-5 flex items-center gap-3 rounded-xl border border-line bg-background/40 p-2.5">
            <span className="w-8 h-8 rounded-lg bg-brand text-on-brand flex items-center justify-center text-sm display shrink-0">{initial}</span>
            <div className="min-w-0">
              <p className="text-sm text-foreground truncate">{userName ?? "Staff"}</p>
              <p className="text-[10px] uppercase tracking-wide text-brand">{role === "follow_up" ? "Follow-up VA" : role}</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-5">
            {groups.map((g) => (
              <div key={g.title} className="mb-5">
                <p className="px-2 text-[10px] display uppercase tracking-[0.18em] text-muted mb-1.5">{g.title}</p>
                <div className="space-y-0.5">
                  {g.items.map((it) => {
                    const on = isActive(it.href);
                    return (
                      <Link
                        key={it.href}
                        href={it.href}
                        className={`flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors ${
                          on
                            ? "bg-brand/10 text-brand display border-l-2 border-brand rounded-l-none"
                            : "text-foreground/75 hover:text-foreground hover:bg-background/40"
                        }`}
                      >
                        <AdminIcon name={it.icon} className={`w-[17px] h-[17px] shrink-0 ${on ? "text-brand" : "text-muted"}`} />
                        {it.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </nav>

      {/* Mobile: a compact bar showing where you are + a Menu toggle that opens
          the full destination list as a tap grid - no sideways scrolling to
          reach a page. */}
      <nav className="lg:hidden sticky top-0 z-40 border-b border-line bg-steel/95 backdrop-blur">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <Link href="/admin" className="flex items-center gap-2 min-w-0" onClick={() => setNavOpen(false)}>
            <Image src="/slugger-logo.png" alt="Slugger Athletics" width={90} height={54} className="h-7 w-auto shrink-0" />
            <span className="display text-sm text-foreground/90 truncate">{currentLabel}</span>
          </Link>
          <button
            type="button"
            onClick={() => setNavOpen((v) => !v)}
            aria-expanded={navOpen}
            aria-label="Menu"
            className="display text-sm text-foreground border border-line px-3 min-h-[44px] inline-flex items-center gap-2 hover:border-brand/50"
          >
            {navOpen ? "✕" : "☰"} Menu
          </button>
        </div>
        {navOpen && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 px-3 pb-3 max-h-[70dvh] overflow-y-auto">
            {allItems.map((it) => {
              const on = isActive(it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => setNavOpen(false)}
                  className={`flex items-center gap-2 text-sm display px-3 min-h-[44px] rounded-md border ${
                    on ? "bg-brand text-on-brand border-brand" : "border-line text-foreground/85 hover:border-brand/50"
                  }`}
                >
                  <AdminIcon name={it.icon} className="w-4 h-4 shrink-0" />
                  <span className="truncate">{it.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </nav>
    </>
  );
}
