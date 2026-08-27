"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Show/hide an approved design in the public "Recent Designs" showcase.
 *  Approved designs show by default; this pulls one down without touching
 *  anything else. */
export function AdminGalleryToggle({ designId, hidden }: { designId: string; hidden: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/design-request/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: designId, hidden: !hidden }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      router.refresh();
    } catch (e) {
      window.alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      title={hidden ? "Hidden from the public gallery - click to show" : "Showing in the public gallery - click to hide"}
      className={`text-xs display px-2 py-0.5 border disabled:opacity-50 whitespace-nowrap ${
        hidden ? "border-line text-muted hover:border-brand/40" : "border-brand/60 text-brand bg-brand/10"
      }`}
    >
      {busy ? "..." : hidden ? "Hidden" : "In gallery ✓"}
    </button>
  );
}
