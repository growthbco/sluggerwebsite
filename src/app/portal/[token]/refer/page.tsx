import Link from "next/link";
import type { Metadata } from "next";
import { readPortalToken, getCustomerOrdersCached } from "@/lib/portal";
import { ReferralCard } from "@/components/portal-account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Refer", robots: { index: false } };

export default async function PortalReferPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const email = readPortalToken(token);
  if (!email) {
    return (
      <div className="text-center py-16">
        <h1 className="display text-2xl text-foreground">This link expired</h1>
        <Link href="/portal" className="inline-block mt-5 rounded bg-brand text-on-brand display px-6 py-3 hover:bg-brand-dark">Get a new link</Link>
      </div>
    );
  }
  const data = await getCustomerOrdersCached(email);
  const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";
  const referralUrl = `${SITE}/r/${data.profile.referralCode}`;
  return (
    <div className="space-y-6">
      <h2 className="display text-2xl text-foreground">Refer a team</h2>
      <p className="text-muted -mt-2">Share your link with another coach. When their team places their first order, you both get a <span className="text-foreground">$25 credit</span> toward your next Slugger order.</p>
      <ReferralCard referralUrl={referralUrl} creditCents={data.profile.referralCreditCents} />
    </div>
  );
}
