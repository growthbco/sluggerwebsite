"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

// The persistent admin nav: one place to reach everything, grouped the way
// the work actually flows. Anchor items jump to dashboard sections; page
// items highlight when you're on them.
const GROUPS: { title: string; items: { href: string; label: string; icon: string }[] }[] = [
  {
    title: "Menu",
    items: [
      { href: "/admin", label: "Dashboard", icon: "📊" },
      { href: "/admin/texts", label: "Conversations", icon: "💬" },
      { href: "/admin/customers", label: "Customers", icon: "👥" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/admin/design-requests", label: "Design Requests", icon: "🎨" },
      { href: "/admin/team-orders", label: "Team Orders", icon: "📦" },
      { href: "/admin/design-lab", label: "Design Lab Leads", icon: "🧪" },
      { href: "/admin/stores", label: "Team Stores", icon: "🏪" },
      { href: "/admin/shop-orders", label: "Shop Orders", icon: "🛒" },
    ],
  },
  {
    title: "Financials",
    items: [
      { href: "/admin/invoice/new", label: "New Invoice", icon: "🧾" },
      { href: "/admin/awaiting-payment", label: "Awaiting Payment", icon: "💸" },
      { href: "/admin/payments", label: "Payments", icon: "💳" },
    ],
  },
  {
    title: "Settings",
    items: [{ href: "/admin/assistant", label: "AI Assistant", icon: "🤖" }],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  // The login page gets no chrome; everything else under /admin does.
  if (pathname === "/admin/login") return null;

  const isActive = (href: string) => !href.includes("#") && pathname === href;

  return (
    <>
      {/* Desktop: truly fixed left rail - pinned to the viewport so it never
          scrolls with the page. The outer nav is just a width spacer. */}
      <nav className="hidden lg:block w-52 shrink-0">
        <div className="fixed inset-y-0 left-0 z-30 w-52 overflow-y-auto border-r border-line bg-steel/95 px-3 py-5">
          <Link href="/admin" className="block px-2 pb-5">
            <Image src="/slugger-logo.png" alt="Slugger Athletics" width={120} height={72} className="h-14 w-auto" />
          </Link>
          {GROUPS.map((g) => (
            <div key={g.title} className="mb-5">
              <p className="px-2 text-[10px] display uppercase tracking-[0.14em] text-muted">{g.title}</p>
              <div className="mt-1.5 space-y-0.5">
                {g.items.map((it) => (
                  <Link
                    key={it.href}
                    href={it.href}
                    className={`flex items-center gap-2.5 px-2 py-1.5 text-sm border-l-2 ${
                      isActive(it.href)
                        ? "border-brand bg-brand/10 text-brand display"
                        : "border-transparent text-foreground/80 hover:text-foreground hover:bg-background/40"
                    }`}
                  >
                    <span className="text-base leading-none">{it.icon}</span>
                    {it.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* Mobile: horizontal scroll bar under the site header */}
      <nav className="lg:hidden sticky top-0 z-40 border-b border-line bg-steel/95 backdrop-blur px-2 py-2 overflow-x-auto">
        <div className="flex gap-1.5 w-max">
          {GROUPS.flatMap((g) => g.items).map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={`whitespace-nowrap text-xs display px-2.5 py-1.5 border ${
                isActive(it.href) ? "bg-brand text-on-brand border-brand" : "border-line text-foreground/80"
              }`}
            >
              {it.icon} {it.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
