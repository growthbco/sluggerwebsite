import type { Metadata } from "next";
import { SportPageTemplate } from "@/components/sport-page";
import { SPORT_PAGES } from "@/lib/sport-pages";

const page = SPORT_PAGES.find((p) => p.slug === "custom-hockey-jerseys")!;

export const metadata: Metadata = {
  title: page.metaTitle,
  description: page.metaDescription,
  alternates: { canonical: `/${page.slug}` },
};

export default function Page() {
  return <SportPageTemplate page={page} photoOffset={40} />;
}
