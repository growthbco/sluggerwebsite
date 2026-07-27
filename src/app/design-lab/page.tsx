import type { Metadata } from "next";
import { DesignLab } from "@/components/design-lab";

export const metadata: Metadata = {
  title: "Free AI Jersey Design Lab - See Your Uniform in Seconds",
  description:
    "Design your team's custom jersey with AI - pick your sport, colors, and idea, upload a logo or sketch, and see a front-and-back concept in seconds. Free to try; our real designer makes the production version.",
  alternates: { canonical: "/design-lab" },
};

export default async function DesignLabPage({ searchParams }: { searchParams: Promise<{ key?: string; ladder?: string; paid?: string }> }) {
  const { key, ladder, paid } = await searchParams;
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
      <span className="display text-brand text-sm">Free To Try · Front &amp; Back · Made Real By Our Designer</span>
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
