"use client";

import { useEffect } from "react";
import { STAFF_DEVICE_KEY } from "@/components/staff-shortcut";

/** Rendered by the (password-gated) admin page: remembers this browser as a
 *  staff device so the floating "⚡ Staff" shortcut shows up site-wide. */
export function MarkStaffDevice() {
  useEffect(() => {
    try {
      localStorage.setItem(STAFF_DEVICE_KEY, "1");
    } catch {}
  }, []);
  return null;
}
