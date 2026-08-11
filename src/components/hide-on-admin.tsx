"use client";

import { usePathname } from "next/navigation";

/** The marketing site chrome (header, footer, public chat bubble) has no
 *  business inside the back office - it was covering the top of the admin
 *  sidebar. Anything wrapped in this renders everywhere EXCEPT /admin. */
export function HideOnAdmin({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;
  return <>{children}</>;
}
