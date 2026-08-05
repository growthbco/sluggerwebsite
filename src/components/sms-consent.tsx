// A2P 10DLC-compliant SMS disclosure shown under every phone field. Carriers
// review the site for exactly this language before approving our texting
// campaign - keep the STOP/HELP wording and the policy links.
export function SmsConsentNote() {
  return (
    <p className="mt-1 text-[11px] leading-snug text-muted/80">
      By providing your phone number, you agree to receive order-related text
      messages from Slugger Athletics. Msg frequency varies, msg &amp; data rates
      may apply. Reply STOP to opt out, HELP for help. See our{" "}
      <a href="/privacy" className="underline hover:text-foreground">Privacy Policy</a> and{" "}
      <a href="/terms" className="underline hover:text-foreground">SMS Terms</a>.
    </p>
  );
}
