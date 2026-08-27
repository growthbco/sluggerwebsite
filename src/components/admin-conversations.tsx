"use client";

import { useState } from "react";
import { AdminTextsInbox } from "@/components/admin-texts-inbox";
import { AdminEmailInbox } from "@/components/admin-email-inbox";

type Tab = "texts" | "email";

/** The Conversations hub: one page, two channels. Texts/WhatsApp (the shop
 *  line) and Email (design-request threads) share the same screen behind a
 *  toggle, so nothing sits unseen in a place you have to go hunting for. */
export function AdminConversations({
  initialTab = "texts",
  initialPhone,
  initialName,
  initialOpen,
}: {
  initialTab?: Tab;
  initialPhone?: string;
  initialName?: string;
  initialOpen?: string;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div>
      <div className="mb-6 inline-flex border border-line bg-steel p-1">
        {(["texts", "email"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`display px-5 py-2 text-sm ${tab === t ? "bg-brand text-on-brand" : "text-muted hover:text-foreground"}`}
          >
            {t === "texts" ? "Texts" : "Email"}
          </button>
        ))}
      </div>

      {/* Both mount so channel state (drafts, scroll) survives a toggle; only
          the active one is shown. */}
      <div className={tab === "texts" ? "" : "hidden"}>
        <AdminTextsInbox initialPhone={initialPhone} initialName={initialName} />
      </div>
      <div className={tab === "email" ? "" : "hidden"}>
        <AdminEmailInbox initialOpen={initialOpen} />
      </div>
    </div>
  );
}
