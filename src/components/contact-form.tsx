"use client";

import { useEffect, useState } from "react";
import { loadRememberedContact, saveRememberedContact } from "@/lib/remembered-contact";

const SUBJECTS = ["Team order", "Custom design / quote", "Order status", "Returns & exchanges", "Something else"];

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  // Prefill for returning visitors (stored in their own browser only).
  useEffect(() => {
    const saved = loadRememberedContact();
    if (saved) {
      setName((v) => v || saved.name);
      setEmail((v) => v || saved.email);
      setPhone((v) => v || saved.phone);
    }
  }, []);

  const inputCls =
    "w-full bg-steel border border-line px-3 py-2.5 text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none";

  async function submit() {
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, subject, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send your message.");
      setStatus("done");
      saveRememberedContact({ name, email, phone });
    } catch (e) {
      setStatus("error");
      setError((e as Error).message);
    }
  }

  if (status === "done") {
    return (
      <div className="bg-steel border border-line p-8 text-center">
        <div className="mx-auto h-12 w-12 grid place-items-center clip-slant bg-brand text-on-brand display text-xl">✓</div>
        <h2 className="display text-2xl text-foreground mt-4">Message sent, {name || "thanks"}!</h2>
        <p className="mt-3 text-muted">We&apos;ll get back to you within one business day.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="display text-sm text-foreground">Name *</label>
          <input className={`mt-2 ${inputCls}`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </div>
        <div>
          <label className="display text-sm text-foreground">Email *</label>
          <input className={`mt-2 ${inputCls}`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="display text-sm text-foreground">Phone <span className="text-muted normal-case">(optional)</span></label>
          <input className={`mt-2 ${inputCls}`} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(352) 660-1232" />
        </div>
        <div>
          <label className="display text-sm text-foreground">What&apos;s this about?</label>
          <select className={`mt-2 ${inputCls}`} value={subject} onChange={(e) => setSubject(e.target.value)}>
            {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="display text-sm text-foreground">Message *</label>
        <textarea
          className={`mt-2 ${inputCls} min-h-32 resize-y`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us about your team, your idea, or your question."
        />
      </div>

      {status === "error" && <p className="text-sm text-brand">{error}</p>}

      <button
        onClick={submit}
        disabled={status === "sending" || !name || !email || !message}
        className="w-full clip-slant bg-brand hover:bg-brand-dark text-on-brand display text-lg py-3.5 transition-colors disabled:opacity-60"
      >
        {status === "sending" ? "Sending…" : "Send Message"}
      </button>
    </div>
  );
}
