import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dbEnabled } from "@/db";
import { getStoreByHandle } from "@/lib/team-stores";
import { getStoreRoster } from "@/lib/store-print-file";
import { PrintFileQA } from "@/components/print-file-qa";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Store Print-File QA",
  robots: { index: false, follow: false },
};

export default async function StoreVerifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!dbEnabled()) notFound();
  const store = await getStoreByHandle(token);
  if (!store) notFound();
  const roster = await getStoreRoster(store.id);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
      <span className="display text-brand text-sm">Designer Tool · Not Public</span>
      <h1 className="display text-3xl sm:text-4xl text-foreground mt-1">{store.name} - Print-File QA</h1>
      <p className="mt-3 text-muted">
        Upload the print file for these store add-ons and the AI checks every jersey&apos;s name, number,
        and size against what was ordered - so typos get caught before printing. {roster.length} paid
        add-on {roster.length === 1 ? "jersey" : "jerseys"} to verify against.
      </p>
      <div className="mt-8">
        <PrintFileQA
          token={token}
          basePath={`/api/store/${token}`}
          rosterCount={roster.length}
          roster={roster}
          initialPrintFileUrls={store.storePrintFileUrls}
          initialResult={store.storePrintFileQa ?? null}
        />
      </div>
    </div>
  );
}
