"use client";

import { useCallback, useEffect, useState } from "react";

type User = { id: string; name: string; role: string; active: boolean; createdAt: string };

const ROLE_DESC: Record<string, string> = {
  owner: "Everything, including this settings page",
  staff: "Everything except user management",
  designer: "Restricted design and production portal - no customer contacts, inboxes, addresses, payments, or store data",
};

/** Owner-only user manager: each person gets their OWN password (that's how
 *  login knows who they are) and a role that decides what they can see. */
export function AdminUsersPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState("");
  const [role, setRole] = useState("designer");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (res.ok) setUsers(data.users ?? []);
      else setError(data.error ?? "Could not load users");
    } catch {}
  }, []);
  useEffect(() => {
    const timeout = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  async function call(method: string, body: object, okMsg: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/admin/users", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setNotice(okMsg);
      load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addUser() {
    if (await call("POST", { name, role, password }, `${name} added - give them their password so they can log in.`)) {
      setName("");
      setPassword("");
    }
  }

  return (
    <div className="space-y-6">
      <section className="border border-line bg-steel p-5">
        <h2 className="display text-lg text-foreground">Add a user</h2>
        <p className="text-sm text-muted mt-1">
          No usernames - each person logs in at /admin/login with their own password, and that password
          decides who they are and what they see.
        </p>
        <div className="mt-4 grid sm:grid-cols-3 gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (e.g. Bonans)"
            maxLength={40}
            className="bg-background border border-line px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
          />
          <select value={role} onChange={(e) => setRole(e.target.value)} className="bg-background border border-line px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none">
            <option value="designer">Designer</option>
            <option value="staff">Staff</option>
            <option value="owner">Owner</option>
          </select>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Their password (8+ chars)"
            maxLength={80}
            className="bg-background border border-line px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
          />
        </div>
        <p className="mt-2 text-xs text-muted">{ROLE_DESC[role]}</p>
        <button
          type="button"
          onClick={addUser}
          disabled={busy || !name.trim() || password.length < 8}
          className="mt-3 clip-slant bg-brand hover:bg-brand-dark text-on-brand display text-sm px-5 py-2 disabled:opacity-50"
        >
          {busy ? "Working…" : "Add user"}
        </button>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        {notice && <p className="mt-2 text-sm text-brand">{notice}</p>}
      </section>

      <section className="border border-line bg-steel">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="display text-lg text-foreground">Users ({users.length})</h2>
          <p className="text-sm text-muted mt-0.5">You (the owner password in the site settings) are always able to log in - this list is everyone else.</p>
        </div>
        <div className="divide-y divide-[color:var(--line)]">
          {users.length === 0 && <p className="px-5 py-5 text-sm text-muted">No users yet - add your first one above.</p>}
          {users.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
              <div>
                <span className="text-foreground display">{u.name}</span>
                {!u.active && <span className="ml-2 text-xs display text-red-400">DISABLED</span>}
                <span className="block text-xs text-muted mt-0.5">{ROLE_DESC[u.role] ?? u.role}</span>
              </div>
              <span className="flex flex-wrap items-center gap-2">
                <select
                  value={u.role}
                  disabled={busy}
                  onChange={(e) => call("PUT", { id: u.id, role: e.target.value }, `${u.name} is now ${e.target.value}.`)}
                  className="bg-background border border-line px-2 py-1 text-xs text-foreground"
                >
                  <option value="designer">Designer</option>
                  <option value="staff">Staff</option>
                  <option value="owner">Owner</option>
                </select>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const pw = window.prompt(`New password for ${u.name} (8+ characters):`);
                    if (pw) call("PUT", { id: u.id, password: pw }, `${u.name}'s password updated.`);
                  }}
                  className="text-xs display text-muted border border-line px-2 py-1 hover:border-brand/50 hover:text-foreground"
                >
                  Reset password
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => call("PUT", { id: u.id, active: !u.active }, u.active ? `${u.name} disabled.` : `${u.name} re-enabled.`)}
                  className="text-xs display text-muted border border-line px-2 py-1 hover:border-brand/50 hover:text-foreground"
                >
                  {u.active ? "Disable" : "Enable"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`Remove ${u.name}? They won't be able to log in anymore.`)) {
                      call("DELETE", { id: u.id }, `${u.name} removed.`);
                    }
                  }}
                  className="text-xs display text-red-400/80 border border-red-500/40 px-2 py-1 hover:bg-red-500/10"
                >
                  Remove
                </button>
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
