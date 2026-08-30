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
  currentUserName,
  restricted = false,
}: {
  initialTab?: Tab;
  initialPhone?: string;
  initialName?: string;
  initialOpen?: string;
  currentUserName: string;
  restricted?: boolean;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-line">
        <div className="flex items-center gap-6">
          {(["texts", "email"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`relative min-h-[44px] px-1 pb-3 pt-2 text-sm outline-none transition-colors focus-visible:ring-1 focus-visible:ring-brand ${tab === t ? "text-brand" : "text-muted hover:text-foreground"}`}
            >
              <span className="display">
                {t === "texts" ? "Text messages" : "Email"}
              </span>
              {tab === t && (
                <span
                  className="absolute inset-x-0 bottom-[-1px] h-0.5 bg-brand"
                  aria-hidden="true"
                />
              )}
            </button>
          ))}
        </div>
        <p className="hidden text-xs text-muted md:block">
          {tab === "texts"
            ? "SMS, WhatsApp and internal notes"
            : "Design-request email threads"}
        </p>
      </div>

      {/* Both mount so channel state (drafts, scroll) survives a toggle; only
          the active one is shown. */}
      <div className={tab === "texts" ? "" : "hidden"}>
        <AdminTextsInbox
          initialPhone={initialPhone}
          initialName={initialName}
          restricted={restricted}
        />
      </div>
      <div className={tab === "email" ? "" : "hidden"}>
        <AdminEmailInbox
          initialOpen={initialOpen}
          currentUserName={currentUserName}
          restricted={restricted}
        />
      </div>
    </div>
  );
}
