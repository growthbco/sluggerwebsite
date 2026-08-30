import type { Metadata } from "next";
import Image from "next/image";
import { readdirSync } from "node:fs";
import path from "node:path";
import {
  ChartTable,
  CheerSizingNotes,
  JERSEYS_ADULT,
  JERSEYS_YOUTH,
  VOLLEYBALL_GIRLS_ADULT,
  VOLLEYBALL_GIRLS_YOUTH,
  CHEER_SET,
  CHEER_SET_HEADERS,
  HOODIES,
  PANTS_ADULT,
  PANTS_YOUTH,
  FITTED_HATS,
  FITTED_HAT_HEADERS,
} from "@/components/size-charts";

export const metadata: Metadata = {
  alternates: { canonical: "/size-guide" },
  title: "Size Guide - Jerseys, Cheer, Volleyball, Hoodies & Pants",
  description:
    "Sizing charts for Slugger Athletics custom jerseys, cheer uniforms, girls volleyball jerseys, hoodies, and pants. Measurements in inches for youth and adult sizes.",
};

function getUploadedCharts(): { file: string; title: string }[] {
  try {
    const dir = path.join(process.cwd(), "public", "size-charts");
    return readdirSync(dir)
      .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
      .sort()
      .map((f) => ({ file: `/size-charts/${f}`, title: f.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ") }));
  } catch {
    return [];
  }
}

export default function SizeGuidePage() {
  const uploaded = getUploadedCharts();

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
      <header className="max-w-2xl">
        <span className="display text-brand text-sm">Sizing</span>
        <h1 className="display text-4xl sm:text-5xl text-foreground mt-1">Size Guide</h1>
        <p className="mt-3 text-muted">
          All measurements are in inches. Our jerseys have a relaxed fit and run slightly large - when in doubt, size down or reach out and we&apos;ll help.
        </p>
      </header>

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Size chart sections">
        {[
          ["#jerseys", "Jerseys"],
          ["#girls-volleyball", "Girls' Volleyball"],
          ["#cheer", "Cheer"],
          ["#hoodies", "Hoodies"],
          ["#hats", "Hats"],
          ["#pants", "Pants"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="inline-flex min-h-11 items-center rounded-full border border-line bg-steel px-4 text-sm text-foreground hover:border-brand/60">
            {label}
          </a>
        ))}
      </nav>

      <div className="mt-12 space-y-14">
        <section id="jerseys" className="scroll-mt-32">
          <h2 className="display text-2xl text-foreground">Jerseys</h2>
          <div className="mt-4 grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="display text-sm text-brand mb-2">Adult</h3>
              <ChartTable headers={["Size", "Width", "Length"]} rows={JERSEYS_ADULT} />
            </div>
            <div>
              <h3 className="display text-sm text-brand mb-2">Youth</h3>
              <ChartTable headers={["Size", "Width", "Length"]} rows={JERSEYS_YOUTH} />
            </div>
          </div>
        </section>

        <section id="girls-volleyball" className="scroll-mt-32">
          <h2 className="display text-2xl text-foreground">Girls&apos; Volleyball Jerseys</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Use these measurements for our girls&apos; volleyball V-neck jerseys. Width and length are measured in inches.
          </p>
          <div className="mt-4 grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="display text-sm text-brand mb-2">Adult</h3>
              <ChartTable headers={["Size", "Width", "Length"]} rows={VOLLEYBALL_GIRLS_ADULT} />
            </div>
            <div>
              <h3 className="display text-sm text-brand mb-2">Youth</h3>
              <ChartTable headers={["Size", "Width", "Length"]} rows={VOLLEYBALL_GIRLS_YOUTH} />
            </div>
          </div>
        </section>

        <section id="cheer" className="scroll-mt-32">
          <h2 className="display text-2xl text-foreground">Cheer Uniforms</h2>
          <CheerSizingNotes />
          <div className="mt-4">
            <p className="mb-2 text-xs text-muted sm:hidden">Swipe sideways to see all measurements.</p>
            <ChartTable headers={CHEER_SET_HEADERS} rows={CHEER_SET} wide />
          </div>
        </section>

        <section id="hoodies" className="scroll-mt-32">
          <h2 className="display text-2xl text-foreground">Hoodies</h2>
          <div className="mt-4 max-w-md">
            <ChartTable headers={["Size", "Width", "Length"]} rows={HOODIES} />
          </div>
        </section>

        <section id="hats" className="scroll-mt-32">
          <h2 className="display text-2xl text-foreground">Fitted Hats</h2>
          <div className="mt-4 max-w-md">
            <ChartTable headers={FITTED_HAT_HEADERS} rows={FITTED_HATS} />
            <p className="mt-2 text-sm text-muted">Snapbacks are one-size adjustable.</p>
          </div>
        </section>

        <section id="pants" className="scroll-mt-32">
          <h2 className="display text-2xl text-foreground">Pants (Knickers & Long Pants)</h2>
          <div className="mt-4 grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="display text-sm text-brand mb-2">Adult</h3>
              <ChartTable headers={["Size", "Waist", "Inseam"]} rows={PANTS_ADULT} />
            </div>
            <div>
              <h3 className="display text-sm text-brand mb-2">Youth</h3>
              <ChartTable headers={["Size", "Waist", "Inseam"]} rows={PANTS_YOUTH} />
            </div>
          </div>
        </section>

        {uploaded.length > 0 && (
          <section>
            <h2 className="display text-2xl text-foreground">More Charts</h2>
            <div className="mt-4 space-y-8">
              {uploaded.map((c) => (
                <figure key={c.file}>
                  <div className="relative bg-white border border-line p-2">
                    <Image src={c.file} alt={`${c.title} size chart`} width={1200} height={800} className="w-full h-auto" unoptimized />
                  </div>
                </figure>
              ))}
            </div>
          </section>
        )}
      </div>

      <p className="mt-12 text-sm text-muted">
        Need help choosing? Email <a href="mailto:apparel@sluggerathletics.com" className="text-brand hover:underline">apparel@sluggerathletics.com</a> or call <a href="tel:+13524147270" className="text-brand hover:underline">352-414-7270</a>.
      </p>
    </div>
  );
}
