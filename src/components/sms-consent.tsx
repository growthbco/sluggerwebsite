"use client";

import { useState } from "react";

// A2P 10DLC-compliant SMS opt-in shown under every phone field. Carriers
// require an ACTIVELY-checked (never pre-checked) checkbox for web-form
// opt-in - our registered campaign describes exactly this control, so keep
// the wording and the STOP/HELP language intact.
export function SmsConsentNote() {
  const [agreed, setAgreed] = useState(false);
  return (
    <label className="mt-1.5 flex items-start gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={agreed}
        onChange={(e) => setAgreed(e.target.checked)}
        name="smsConsent"
        className="mt-0.5 accent-[#b8a36c]"
      />
      <span className="text-[11px] leading-snug text-muted/80">
        I agree to receive order-related text messages from Slugger Athletics.
        Msg frequency varies, msg &amp; data rates may apply. Reply STOP to opt
        out, HELP for help. See our{" "}
        <a href="/privacy" className="underline hover:text-foreground" onClick={(e) => e.stopPropagation()}>Privacy Policy</a> and{" "}
        <a href="/terms" className="underline hover:text-foreground" onClick={(e) => e.stopPropagation()}>SMS Terms</a>.
        Consent is not a condition of purchase.
      </span>
    </label>
  );
}
