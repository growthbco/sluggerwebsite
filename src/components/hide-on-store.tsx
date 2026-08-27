"use client";

import { usePathname } from "next/navigation";

/** Hides its children on pages that render their own minimal shell instead of
 *  the marketing chrome: private team stores (/store/*), the customer order
 *  portal (/portal/*), and the print-vendor billing tool (/designer/*). */
export function HideOnStore({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (
    pathname.startsWith("/store/") ||
    pathname.startsWith("/portal/") ||
    pathname.startsWith("/designer/")
  )
    return null;
  return <>{children}</>;
}
