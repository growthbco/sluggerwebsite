"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-24">
      <h1 className="display text-3xl text-foreground text-center">Team Login</h1>
      <p className="mt-2 text-sm text-muted text-center">Use the personal password Slugger assigned you.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password"
          autoFocus
          className="w-full bg-steel border border-line px-3 py-2.5 text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !password}
          className="w-full clip-slant bg-brand text-on-brand display text-lg px-6 py-3 hover:bg-brand-dark disabled:opacity-50"
        >
          {busy ? "Signing in..." : "Sign In"}
        </button>
        {error && <p className="text-sm text-brand text-center">{error}</p>}
      </form>
    </div>
  );
}
