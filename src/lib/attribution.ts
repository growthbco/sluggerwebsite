import { cookies } from "next/headers";

// Pretty names for common referrer hosts / utm sources.
const KNOWN: [RegExp, string][] = [
  [/google/i, "Google"],
  [/instagram/i, "Instagram"],
  [/facebook|(^|\.)fb\./i, "Facebook"],
  [/tiktok/i, "TikTok"],
  [/(^|\.)t\.co$|twitter|(^|\.)x\.com$/i, "X (Twitter)"],
  [/bing/i, "Bing"],
  [/duckduckgo/i, "DuckDuckGo"],
  [/yahoo/i, "Yahoo"],
  [/youtube/i, "YouTube"],
  [/reddit/i, "Reddit"],
  [/nextdoor/i, "Nextdoor"],
];

function pretty(raw: string): string {
  for (const [re, name] of KNOWN) if (re.test(raw)) return name;
  return raw.replace(/^www\./, "");
}

/**
 * The visitor's first-touch source as one readable line, e.g.
 * "Google → /custom-softball-uniforms", "Instagram (ad)", "Direct".
 * Reads the slugger_attr cookie set by <AttributionCapture />.
 * Call only inside a request scope. Returns null when nothing was captured.
 */
export async function attributionFromCookie(): Promise<string | null> {
  try {
    const raw = (await cookies()).get("slugger_attr")?.value;
    if (!raw) return null;
    const d = JSON.parse(decodeURIComponent(raw)) as {
      r?: string; s?: string; m?: string; c?: string; g?: number; f?: number; l?: string;
    };
    const base = d.s?.trim() || (d.g ? "Google" : d.f ? "Facebook/Instagram" : d.r?.trim() || "");
    const src = base ? pretty(base) : "Direct";
    // Ad-click markers and utm medium/campaign add useful nuance.
    const extras = [d.g ? "ad" : d.f ? "ad" : "", d.m?.trim() ?? "", d.c?.trim() ?? ""].filter(Boolean).join(" / ");
    const landing = d.l && d.l !== "/" ? ` → ${d.l}` : "";
    return `${src}${extras ? ` (${extras})` : ""}${landing}`.slice(0, 200);
  } catch {
    return null;
  }
}
