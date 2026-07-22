"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const STAFF_DEVICE_KEY = "slugger-staff-device";

/** Floating one-tap shortcut to /admin, shown ONLY on devices that have
 *  opened the admin dashboard before (flag set by MarkStaffDevice on the
 *  admin page). Customers never see it; the admin page itself is still
 *  password-gated - this is just navigation. */
export function StaffShortcut() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      setShow(localStorage.getItem(STAFF_DEVICE_KEY) === "1");
    } catch {}
  }, []);

  if (!show || pathname.startsWith("/admin")) return null;

  return (
    <Link
      href="/admin"
      className="fixed bottom-4 right-4 z-50 clip-slant bg-brand text-on-brand display text-sm px-4 py-2.5 shadow-lg hover:bg-brand-dark transition-colors"
      title="Slugger staff dashboard"
    >
      ⚡ Staff
    </Link>
  );
}
