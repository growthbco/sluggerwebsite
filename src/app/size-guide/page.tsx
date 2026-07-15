import type { Metadata } from "next";
import Image from "next/image";
import { readdirSync } from "node:fs";
import path from "node:path";
import {
  ChartTable,
  JERSEYS_ADULT,
  JERSEYS_YOUTH,
  HOODIES,
  PANTS_ADULT,
  PANTS_YOUTH,
  FITTED_HATS,
  FITTED_HAT_HEADERS,
} from "@/components/size-charts";

export const metadata: Metadata = {
  title: "Size Guide - Jerseys, Hoodies & Pants",
  description:
    "Sizing charts for Slugger Athletics custom jerseys, hoodies, and pants. Measurements in inches for youth and adult sizes.",
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
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-14">
      <header className="max-w-2xl">
        <span className="display text-brand text-sm">Sizing</span>
        <h1 className="display text-4xl sm:text-5xl text-foreground mt-1">Size Guide</h1>
        <p className="mt-3 text-muted">
          All measurements are in inches. Our jerseys have a relaxed fit and run
          slightly large - when in doubt, size down or reach out and we&apos;ll help.
        </p>
      </header>

      <div className="mt-12 space-y-14">
        <section>
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

        <section>
          <h2 className="display text-2xl text-foreground">Hoodies</h2>
          <div className="mt-4 max-w-md">
            <ChartTable headers={["Size", "Width", "Length"]} rows={HOODIES} />
          </div>
        </section>

        <section>
          <h2 className="display text-2xl text-foreground">Fitted Hats</h2>
          <div className="mt-4 max-w-md">
            <ChartTable headers={FITTED_HAT_HEADERS} rows={FITTED_HATS} />
            <p className="mt-2 text-sm text-muted">Snapbacks are one-size adjustable.</p>
          </div>
        </section>

        <section>
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
        Need help choosing? Email <a href="mailto:apparel@sluggerathletics.com" className="text-brand hover:underline">apparel@sluggerathletics.com</a> or call <a href="tel:+13526601232" className="text-brand hover:underline">352-660-1232</a>.
      </p>
    </div>
  );
}
