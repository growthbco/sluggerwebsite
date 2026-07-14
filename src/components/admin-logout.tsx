"use client";

import { useRouter } from "next/navigation";

export function AdminLogout() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/admin/login", { method: "DELETE" });
        router.push("/admin/login");
        router.refresh();
      }}
      className="text-xs display text-muted border border-line px-3 py-1.5 hover:border-brand/50 hover:text-foreground"
    >
      Sign out
    </button>
  );
}
