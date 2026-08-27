import "server-only";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { designRequests } from "@/db/schema";
import { FEATURED_DESIGNS } from "@/data/featured-designs";

export type RecentDesign = {
  reference: string;
  teamName: string | null;
  sport: string | null;
  image: string;
};

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

// Public "Recent Designs" feed: hand-picked FEATURED_DESIGNS first, then the
// auto-pulled approved designs (newest first). An auto design whose team name
// matches a featured one is de-duped out so nothing shows twice. Staff hide any
// auto design via the galleryHidden toggle in admin; featured ones are curated
// in code. One representative image per design.
export async function recentApprovedDesigns(limit = 12): Promise<RecentDesign[]> {
  const featured: RecentDesign[] = FEATURED_DESIGNS.map((f, i) => ({
    reference: `featured-${i}`,
    teamName: f.teamName,
    sport: null,
    image: f.image,
  }));
  const featuredNames = new Set(featured.map((f) => norm(f.teamName)));

  if (!dbEnabled()) return featured.slice(0, limit);

  const rows = await getDb()
    .select({
      reference: designRequests.reference,
      teamName: designRequests.teamName,
      sport: designRequests.sport,
      image: designRequests.approvedDesignUrl,
    })
    .from(designRequests)
    .where(
      and(
        eq(designRequests.status, "approved"),
        eq(designRequests.galleryHidden, false),
        isNotNull(designRequests.approvedDesignUrl),
        // Only real uploaded mockups (blob URLs) - never local sample/placeholder
        // assets like /mockups/*.png that slip in on test rows.
        sql`${designRequests.approvedDesignUrl} like 'http%'`,
      ),
    )
    .orderBy(desc(designRequests.approvedAt))
    .limit(limit);

  const auto = rows
    .filter((r): r is typeof r & { image: string } => Boolean(r.image))
    .filter((r) => !featuredNames.has(norm(r.teamName)))
    .map((r) => ({ reference: r.reference, teamName: r.teamName, sport: r.sport, image: r.image }));

  return [...featured, ...auto].slice(0, limit);
}
