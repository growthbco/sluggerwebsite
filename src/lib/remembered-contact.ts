// Remember a visitor's contact info in THEIR browser so returning customers
// don't retype it on the design intake / team order / contact forms. Stored
// client-side only - no server lookup, so nothing can be enumerated.

export type RememberedContact = { name: string; email: string; phone: string };

const KEY = "slugger-contact";

export function loadRememberedContact(): RememberedContact | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p?.email) return null;
    return { name: String(p.name ?? ""), email: String(p.email ?? ""), phone: String(p.phone ?? "") };
  } catch {
    return null;
  }
}

export function saveRememberedContact(c: RememberedContact) {
  try {
    if (c.email.trim()) localStorage.setItem(KEY, JSON.stringify(c));
  } catch {}
}
