import type { Metadata } from "next";
import { DesignLab } from "@/components/design-lab";

// PRIVATE preview - deliberately unlinked from nav/sitemap and noindexed.
// Access with ?key=<DESIGN_LAB_KEY> (default slugger26) or an admin session.
export const metadata: Metadata = {
  title: "AI Design Lab (Preview)",
  robots: { index: false, follow: false },
};

export default async function DesignLabPage({ searchParams }: { searchParams: Promise<{ key?: string; ladder?: string; paid?: string }> }) {
  const { key, ladder, paid } = await searchParams;
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
      <span className="display text-brand text-sm">Private Preview · Not Public</span>
      <h1 className="display text-4xl sm:text-5xl text-foreground mt-1">AI Jersey Design Lab</h1>
      <p className="mt-3 text-muted max-w-2xl">
        Describe the uniform, drop in a logo or even a hand-drawn sketch, and see a concept in
        seconds - front and back, in your exact colors.
      </p>
      <div className="mt-10">
        <DesignLab testKey={key} ladder={ladder === "1"} paidJustNow={paid === "1"} />
      </div>
    </div>
  );
}
