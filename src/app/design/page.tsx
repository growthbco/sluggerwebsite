import type { Metadata } from "next";
import Link from "next/link";
import { DesignIntakeForm } from "@/components/design-intake-form";
import { resolveHalloweenConcept } from "@/lib/halloween-designs";
import { resolveChristmasConcept } from "@/lib/christmas-designs";

export const metadata: Metadata = {
  title: "Start a Design - Custom Jersey & Uniform Design",
  description:
    "Start your custom design with Slugger Athletics. Upload inspiration, describe your look, and our in-house designer creates a free mockup for you to approve. No commitment.",
  alternates: { canonical: "/design" },
};

export default async function DesignPage({ searchParams }: { searchParams: Promise<{ campaign?: string; concept?: string; sport?: string }> }) {
  const params = await searchParams;
  const concept = resolveHalloweenConcept(params.campaign, params.concept);
  const christmasConcept = resolveChristmasConcept(params.campaign, params.concept);
  const initialSport = typeof params.sport === "string" ? params.sport.trim().slice(0, 80) : "";
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-14">
      <header className="max-w-2xl">
        <span className="display text-brand text-sm">Free with Order</span>
        <h1 className="display text-4xl sm:text-5xl text-foreground mt-1">Start Your Design</h1>
        <div className="mt-6 max-w-2xl">
          <Link href="/custom-jersey-maker" className="block bg-brand/10 border border-brand/60 hover:bg-brand/20 p-5 transition-colors">
            <span className="display text-[11px] tracking-wider text-brand">⚡ NEW - IMPATIENT? TRY THIS</span>
            <p className="display text-xl sm:text-2xl mt-1 text-foreground">Design It Yourself With AI →</p>
            <p className="text-sm text-muted mt-1">Pick colors, describe your idea, see a front-and-back concept in seconds - then our designer makes it real. Free to try.</p>
          </Link>
          <p className="mt-4 display text-sm text-muted">OR DESCRIBE IT AND OUR DESIGNER TAKES IT FROM HERE ↓</p>
        </div>
        <p className="mt-3 text-muted">
          Tell us what you want. Drop in inspiration images or describe your
          vision &mdash; our in-house designer works up a mockup, sends it
          back, and you approve when you love it.
        </p>
        <p className="mt-3 text-sm text-foreground/90 border-l-2 border-brand pl-3">
          <span className="display text-brand">Free to start.</span> See your team&apos;s
          mockup on us &mdash; no design fee, no commitment.
        </p>
      </header>

      <ol className="mt-8 grid sm:grid-cols-3 gap-3">
        {[
          { n: 1, t: "Describe & upload", d: "Share your vision and any inspiration images." },
          { n: 2, t: "We mock it up", d: "Our designer sends you a free proof to review." },
          { n: 3, t: "Approve & order", d: "Approve the design, then your team places the order." },
        ].map((s) => (
          <li key={s.n} className="bg-steel border border-line p-4">
            <div className="h-8 w-8 grid place-items-center clip-slant bg-brand text-on-brand display text-sm">{s.n}</div>
            <h3 className="display text-foreground mt-3 text-sm">{s.t}</h3>
            <p className="text-sm text-muted mt-1">{s.d}</p>
          </li>
        ))}
      </ol>

      <div className="mt-10">
        <DesignIntakeForm key={`${concept ? `halloween:${concept}` : christmasConcept ? `christmas:${christmasConcept}` : "general"}:${initialSport}`} initialSport={initialSport} halloweenConcept={concept} christmasConcept={christmasConcept} />
      </div>
    </div>
  );
}
