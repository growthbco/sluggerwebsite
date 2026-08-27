import Link from "next/link";
import type { Metadata } from "next";
import { readPortalToken, getCustomerOrdersCached } from "@/lib/portal";
import { ContactCard } from "@/components/portal-account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Address", robots: { index: false } };

export default async function PortalAddressPage({ params }: { params: Promise<{ token: string }> }) {
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
  return (
    <div className="space-y-6">
      <h2 className="display text-2xl text-foreground">Shipping &amp; contact</h2>
      <ContactCard token={token} name={data.profile.name} phone={data.profile.phone} address={data.shippingAddress} />
    </div>
  );
}
