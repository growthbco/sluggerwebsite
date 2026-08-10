"use client";

import { useState } from "react";

// A2P 10DLC-compliant SMS opt-in shown under every phone field. Carriers
// require an ACTIVELY-checked (never pre-checked) checkbox for web-form
// opt-in - our registered campaign describes exactly this control, so keep
// the wording and the STOP/HELP language intact.
export function SmsConsentNote({ onChange }: { onChange?: (agreed: boolean) => void }) {
  const [agreed, setAgreed] = useState(false);
  return (
    <label className="mt-1.5 flex items-start gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={agreed}
        onChange={(e) => {
          setAgreed(e.target.checked);
          onChange?.(e.target.checked);
        }}
        name="smsConsent"
        className="mt-0.5 accent-[#b8a36c]"
      />
      <span className="text-[11px] leading-snug text-muted/80">
        I agree to receive SMS/text messages from Slugger Athletics about my
        order (order confirmations, design proof alerts, invoices, and shipping
        updates). Msg frequency varies. Msg &amp; data rates may apply. Reply
        STOP to cancel, HELP for help. SMS consent is optional and not a
        condition of purchase. See our{" "}
        <a href="/privacy" className="underline hover:text-foreground" onClick={(e) => e.stopPropagation()}>Privacy Policy</a> and{" "}
        <a href="/terms" className="underline hover:text-foreground" onClick={(e) => e.stopPropagation()}>SMS Terms</a>.
      </span>
    </label>
  );
}
