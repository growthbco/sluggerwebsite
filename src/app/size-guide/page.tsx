import type { Metadata } from "next";
import Image from "next/image";
import { readdirSync } from "node:fs";
import path from "node:path";

export const metadata: Metadata = {
  title: "Size Guide - Jerseys, Hoodies & Pants",
  description:
    "Sizing charts for Slugger Athletics custom jerseys, hoodies, and pants. Measurements in inches for youth and adult sizes.",
};

// Measurements from Slugger Athletics' official size charts (inches).
const JERSEYS_ADULT = [
  ["AS", "22", "28.5"], ["AM", "23", "29.5"], ["AL", "24", "30.5"], ["AXL", "25", "31.5"],
  ["A2XL", "26", "32.5"], ["A3XL", "27", "33.5"], ["A4XL", "28", "34.5"], ["A5XL", "29", "35.5"],
];
const JERSEYS_YOUTH = [
  ["YS", "18.5", "24"], ["YM", "19", "24.5"], ["YL", "19.5", "25"], ["YXL", "20", "25.5"],
];
const HOODIES = [
  ["S", "23", "29"], ["M", "24.5", "30"], ["L", "26", "32"], ["XL", "27.5", "33"],
  ["2XL", "29", "35"], ["3XL", "31.5", "36"], ["4XL", "33", "37"], ["5XL", "34", "38"],
];
const PANTS_ADULT = [
  ["XS", "26-28", "29"], ["S", "29-31", "30"], ["M", "32-34", "31"],
  ["L", "35-37", "32"], ["XL", "38-40", "33"], ["XXL", "41-43", "33"],
];
const PANTS_YOUTH = [
  ["S", "23-25", "26"], ["M", "25-27", "26.5"], ["L", "27-29", "27"], ["XL", "29-31", "27.5"],
];

function ChartTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto border border-line">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-brand text-on-brand display">
            {headers.map((h) => (
              <th key={h} className="px-4 py-2.5 font-normal">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r[0]} className={i % 2 ? "bg-steel" : "bg-ink"}>
              {r.map((cell, j) => (
                <td key={j} className={`px-4 py-2.5 ${j === 0 ? "display text-foreground" : "text-muted"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
