import type { Metadata } from "next";
import { DesignLab } from "@/components/design-lab";

export const metadata: Metadata = {
  title: "Custom Jersey Maker - Design Your Own Jersey Free",
  description:
    "Free custom jersey maker: pick your sport and colors, describe your idea, upload a logo or sketch, and see your custom jersey - front and back - in seconds. Our real designer then makes it production-ready.",
  alternates: { canonical: "/custom-jersey-maker" },
  openGraph: {
    title: "Custom Jersey Maker - Design Your Own Jersey Free",
    description:
      "Pick your sport and colors, describe your idea, and see your custom jersey - front and back - in seconds. Our real designer makes it production-ready.",
    url: "/custom-jersey-maker",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Custom Jersey Maker - Design Your Own Jersey Free",
    description: "See your team's custom jersey in seconds - free to try, made real by our designers.",
  },
};

export default async function DesignLabPage({ searchParams }: { searchParams: Promise<{ key?: string; ladder?: string; paid?: string }> }) {
  const { key, ladder, paid } = await searchParams;
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
      <span className="display text-brand text-sm">Free To Try · Front &amp; Back · Made Real By Our Designer</span>
      <h1 className="display text-4xl sm:text-5xl text-foreground mt-1">Custom Jersey Maker</h1>
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
