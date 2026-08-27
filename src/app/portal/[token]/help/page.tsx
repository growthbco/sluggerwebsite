import type { Metadata } from "next";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Help", robots: { index: false } };

export default function PortalHelpPage() {
  return (
    <div className="space-y-6">
      <h2 className="display text-2xl text-foreground">Help</h2>
      <div className="border border-line bg-steel p-5 space-y-4">
        <div>
          <p className="text-xs display uppercase tracking-wide text-muted">Text us</p>
          <a href="sms:+13524147270" className="display text-lg text-brand">(352) 414-7270</a>
          <p className="text-sm text-muted mt-1">Fastest way to reach us about your order.</p>
        </div>
        <div className="border-t border-line pt-4">
          <p className="text-xs display uppercase tracking-wide text-muted">Email</p>
          <a href="mailto:apparel@sluggerathletics.com" className="display text-lg text-brand break-all">apparel@sluggerathletics.com</a>
        </div>
      </div>
    </div>
  );
}
