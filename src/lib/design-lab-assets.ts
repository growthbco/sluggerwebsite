import { put } from "@vercel/blob";
import { and, eq, gt, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { designRequests } from "@/db/schema";

// Shared asset-sheet extraction for the AI design lab: used inline on submit
// and by the daily cron to heal submissions whose sheets failed (the image
// model periodically runs slow enough to blow the inline timeouts).

const WM = " The source image contains a repeated semi-transparent logo watermark overlay - completely remove it; output clean artwork with no watermark.";

export const SHEET_PROMPTS = {
  "pattern-swatch.png":
    "From this jersey design, extract ONLY the background pattern/texture as a flat, full-bleed, seamless square print swatch: the complete pattern at full intensity edge to edge, straight-on view, no garment, no fabric folds, no lettering, no numbers, no logos, no shadows. Production artwork style." + WM,
  "wordmark.png":
    "From this jersey design, extract ONLY the team name wordmark/lettering exactly as styled (same font, colors, outlines, and any swoosh/underline), laid out flat and large, perfectly centered on a plain solid white background. No garment, no pattern, no other elements. Clean logo-sheet presentation." + WM,
  "emblem.png":
    "From this jersey design, extract ONLY the logo/emblem/mascot graphic (if one exists besides the team name lettering), isolated large and centered on a plain solid white background. If there is no distinct emblem, reproduce the most distinctive graphic element instead. No garment, no pattern." + WM,
} as const;

export const SHEET_LABELS: Record<string, string> = {
  "pattern-swatch.png": "🎨 Pattern swatch (print-style)",
  "wordmark.png": "🔤 Wordmark on white (trace-ready)",
  "emblem.png": "🛡️ Emblem on white (AI-invented - trace/redraw)",
};

export async function extractAsset(
  concept: { mime: string; data: string },
  prompt: string,
  timeoutMs = 120000,
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const call = () =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: concept.mime, data: concept.data } }] }],
        generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "1:1" } },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  try {
    let res = await call();
    if (!res.ok) res = await call();
    if (!res.ok) return null;
    const data = await res.json();
    const img = data?.candidates?.[0]?.content?.parts?.find(
      (x: { inlineData?: { data: string }; inline_data?: { data: string } }) => x.inlineData || x.inline_data,
    );
    return (img?.inlineData ?? img?.inline_data)?.data ?? null;
  } catch {
    return null;
  }
}

/** True if a design already has extracted asset sheets among its images (so we
 *  don't regenerate them - approval can fire more than once). */
export function hasAssetSheets(images: string[] | null | undefined): boolean {
  const markers = ["pattern-swatch", "wordmark", "emblem"];
  return (images ?? []).some((u) => markers.some((m) => u.includes(m)));
}

/** Generate the production asset sheets (pattern swatch, team wordmark, emblem)
 *  from a design's finished artwork and post them into its Discord thread - the
 *  SAME trace-ready individual files the AI lab produces on submit. Called on
 *  APPROVAL so designs built/approved manually on the admin side get the
 *  individual files too, not just the mockup. No-ops if the design already has
 *  sheets or has no source image. Returns the URLs it added. */
export async function generateAssetSheets(opts: {
  designId: string;
  reference: string;
  teamName: string;
  sport?: string | null;
  style?: string | null;
  threadId?: string | null;
  currentImages?: string[];
  sourceImageUrl: string;
  includeEmblem?: boolean;
}): Promise<string[]> {
  if (!opts.sourceImageUrl) return [];
  if (hasAssetSheets(opts.currentImages)) return [];
  const db = getDb();
  let concept: { mime: string; data: string };
  try {
    const buf = Buffer.from(await (await fetch(opts.sourceImageUrl)).arrayBuffer());
    concept = { mime: "image/png", data: buf.toString("base64") };
  } catch (e) {
    console.error("generateAssetSheets: could not fetch source image", opts.reference, e);
    return [];
  }
  const names: (keyof typeof SHEET_PROMPTS)[] = ["pattern-swatch.png", "wordmark.png"];
  if (opts.includeEmblem !== false) names.push("emblem.png");
  const added: { name: string; url: string }[] = [];
  for (const name of names) {
    const b64 = await extractAsset(concept, SHEET_PROMPTS[name]);
    if (!b64) continue;
    const blob = await put(`design-requests/sheets/${opts.reference}-${name}`, Buffer.from(b64, "base64"), {
      access: "public", contentType: "image/png", addRandomSuffix: true,
    });
    added.push({ name, url: blob.url });
  }
  if (!added.length) return [];
  // Re-read before appending so a concurrent write (e.g. a second approval)
  // isn't clobbered.
  const [row] = await db
    .select({ imgs: designRequests.inspirationImages })
    .from(designRequests)
    .where(eq(designRequests.id, opts.designId))
    .limit(1);
  await db
    .update(designRequests)
    .set({ inspirationImages: [...(row?.imgs ?? opts.currentImages ?? []), ...added.map((a) => a.url)] })
    .where(eq(designRequests.id, opts.designId));
  const hook = process.env.DISCORD_DESIGN_REQUESTS_WEBHOOK_URL;
  if (hook && opts.threadId) {
    await fetch(`${hook}?thread_id=${opts.threadId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Slugger Design Requests",
        content: `📦 **Production asset sheets - ${opts.teamName}${opts.sport ? ` (${opts.sport}${opts.style ? `, ${opts.style}` : ""})` : ""} - ${opts.reference}**\n` +
          added.map((a) => `${SHEET_LABELS[a.name]}: ${a.url}`).join("\n"),
        embeds: added.slice(0, 4).map((a) => ({ image: { url: a.url } })),
      }),
    }).catch((e) => console.error("asset sheet post failed:", e));
  }
  return added.map((a) => a.url);
}

/** Cron self-heal: find recent AI-lab design requests missing their pattern or
 *  wordmark sheets, extract the missing ones, and post them into the thread. */
export async function healMissingSheets(limit = 2): Promise<{ reference: string; added: string[] }[]> {
  const db = getDb();
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const rows = await db
    .select({
      id: designRequests.id,
      reference: designRequests.reference,
      teamName: designRequests.teamName,
      sport: designRequests.sport,
      imgs: designRequests.inspirationImages,
      thread: designRequests.discordThreadId,
    })
    .from(designRequests)
    .where(and(
      gt(designRequests.createdAt, cutoff),
      ne(designRequests.status, "cancelled"),
      sql`${designRequests.vision} like '%AI DESIGN LAB CONCEPT%'`,
    ));

  const healed: { reference: string; added: string[] }[] = [];
  for (const row of rows) {
    if (healed.length >= limit) break;
    const imgs = row.imgs ?? [];
    const conceptUrl = imgs.find((u) => u.includes("-concept"));
    if (!conceptUrl) continue;
    const missing = (["pattern-swatch.png", "wordmark.png"] as const).filter(
      (name) => !imgs.some((u) => u.includes(name.replace(".png", ""))),
    );
    if (!missing.length) continue;
    try {
      const buf = Buffer.from(await (await fetch(conceptUrl)).arrayBuffer());
      const concept = { mime: "image/png", data: buf.toString("base64") };
      const added: { name: string; url: string }[] = [];
      for (const name of missing) {
        const b64 = await extractAsset(concept, SHEET_PROMPTS[name]);
        if (!b64) continue;
        const blob = await put(`design-lab/submissions/heal-${row.reference}-${name}`, Buffer.from(b64, "base64"), {
          access: "public", contentType: "image/png", addRandomSuffix: true,
        });
        added.push({ name, url: blob.url });
      }
      if (!added.length) continue;
      await db.update(designRequests)
        .set({ inspirationImages: [...imgs, ...added.map((a) => a.url)] })
        .where(eq(designRequests.id, row.id));
      const hook = process.env.DISCORD_DESIGN_REQUESTS_WEBHOOK_URL;
      if (hook && row.thread) {
        await fetch(`${hook}?thread_id=${row.thread}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "Slugger AI Design Lab",
            content: `📦 **Remaining asset sheets - ${row.teamName}${row.sport ? ` (${row.sport})` : ""} - ${row.reference}**\n` +
              added.map((a) => `${SHEET_LABELS[a.name]}: ${a.url}`).join("\n"),
            embeds: added.slice(0, 4).map((a) => ({ image: { url: a.url } })),
          }),
        }).catch(() => {});
      }
      healed.push({ reference: row.reference, added: added.map((a) => a.name) });
    } catch (e) {
      console.error("healMissingSheets failed for", row.reference, e);
    }
  }
  return healed;
}
