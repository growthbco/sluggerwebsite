import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dbEnabled } from "@/db";
import { getStoreByHandle } from "@/lib/team-stores";
import { getStoreGroups, getStoreRoster } from "@/lib/store-print-file";
import { StorePrintFileQA } from "@/components/store-print-file-qa";

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

  const groups = await getStoreGroups(store.id);
  const rosters: Record<string, { name: string; number: string; size: string }[]> = {};
  for (const g of groups) rosters[g.key] = await getStoreRoster(store.id, g.key);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
      <span className="display text-brand text-sm">Designer Tool · Not Public</span>
      <h1 className="display text-3xl sm:text-4xl text-foreground mt-1">{store.name} - Print-File QA</h1>
      <p className="mt-3 text-muted">
        This store has multiple designs, each printed on its own file. Pick a design, upload its print
        file, and the AI checks every jersey&apos;s name, number, and size against only the orders for
        that design - so gray, white, and practice never get cross-checked against each other.
      </p>
      <div className="mt-8">
        <StorePrintFileQA
          token={token}
          groups={groups}
          rosters={rosters}
          qa={store.storePrintFileQa ?? {}}
        />
      </div>
    </div>
  );
}
