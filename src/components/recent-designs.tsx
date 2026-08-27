import Link from "next/link";
import { recentApprovedDesigns } from "@/lib/recent-designs";
import { RecentDesignsGrid } from "@/components/recent-designs-grid";

// Auto-updating showcase of the latest approved mockups. Renders nothing until
// there are designs to show, so it never leaves an empty section on the page.
export async function RecentDesigns() {
  const designs = await recentApprovedDesigns(12);
  if (designs.length < 4) return null; // wait until there's a full-looking row

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20">
      <div className="flex items-end justify-between gap-4">
        <div>
          <span className="display text-brand text-sm">Fresh Off the Board</span>
          <h2 className="display text-3xl sm:text-4xl text-foreground">Recent Designs</h2>
          <p className="mt-2 text-muted text-sm max-w-xl">
            Real mockups our in-house designer just built for teams like yours. Yours is free to start.
          </p>
        </div>
        <Link href="/design" className="display text-sm text-muted hover:text-foreground whitespace-nowrap">
          Start yours →
        </Link>
      </div>

      <RecentDesignsGrid
        designs={designs.map((d) => ({ reference: d.reference, teamName: d.teamName, image: d.image }))}
      />
    </section>
  );
}
