"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** The footer's "Staff" -> /admin link, hidden on customer-facing order pages
 *  (a coach's phone shouldn't see back-office links). */
export function FooterStaffLink() {
  const pathname = usePathname();
  if (pathname.startsWith("/design/status") || pathname.startsWith("/design/manage")) return null;
  return <Link href="/admin" className="hover:text-foreground">Staff</Link>;
}
