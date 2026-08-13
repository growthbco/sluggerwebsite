import { SportPageTemplate } from "@/components/sport-page";
import { SPORT_PAGES, sportMetadata } from "@/lib/sport-pages";

const page = SPORT_PAGES.find((p) => p.slug === "custom-football-uniforms")!;

export const metadata = sportMetadata(page);

export default function Page() {
  return <SportPageTemplate page={page} photoOffset={25} />;
}
