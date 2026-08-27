import { sql } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { aiDailyCounters, aiUsageEvents } from "@/db/schema";

export const DESIGN_LAB_DAILY_CAP = Number(process.env.DESIGN_LAB_DAILY_CAP) || 150;

type UsageMetadata = Record<string, string | number | boolean | null>;

export type AiUsageInput = {
  provider: string;
  model: string;
  operation: string;
  quality?: string;
  status?: "success" | "error" | "refused";
  estimatedCostMicros?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  metadata?: UsageMetadata;
};

/** Best-effort telemetry: an unavailable log table must never break the
 * customer action that already completed. */
export async function recordAiUsage(input: AiUsageInput): Promise<void> {
  if (!dbEnabled()) return;
  try {
    await getDb().insert(aiUsageEvents).values({
      provider: input.provider,
      model: input.model,
      operation: input.operation,
      quality: input.quality,
      status: input.status ?? "success",
      estimatedCostMicros: input.estimatedCostMicros,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      totalTokens: input.totalTokens,
      metadata: input.metadata,
    });
  } catch (error) {
    console.error("AI usage log failed:", error);
  }
}

/** GPT Image 2 output-image estimates from OpenAI's published per-image table.
 * Image-edit input tokens may add a small amount, so the admin UI labels these
 * figures as estimates. */
export function estimateOpenAiImageCostMicros(size: string, quality: string): number | null {
  const square = size === "1024x1024";
  const table = square
    ? { low: 6_000, medium: 53_000, high: 211_000 }
    : { low: 5_000, medium: 41_000, high: 165_000 };
  return table[quality as keyof typeof table] ?? null;
}

/** Reserve one generation atomically. The ON CONFLICT WHERE clause prevents
 * concurrent Vercel instances from incrementing beyond the cap. */
export async function reserveDesignLabGeneration(): Promise<{ used: number; cap: number } | null> {
  if (!dbEnabled()) throw new Error("Database is required for the design-lab spending cap");
  const day = new Date().toISOString().slice(0, 10);
  const scope = "design-lab";
  const id = `${scope}:${day}`;
  const result = await getDb().execute(sql<{ used: number }>`
    insert into ${aiDailyCounters} (id, scope, day, used, updated_at)
    values (${id}, ${scope}, ${day}, 1, now())
    on conflict (id) do update
      set used = ${aiDailyCounters.used} + 1,
          updated_at = now()
      where ${aiDailyCounters.used} < ${DESIGN_LAB_DAILY_CAP}
    returning used
  `);
  const used = Number(result.rows[0]?.used ?? 0);
  return used > 0 ? { used, cap: DESIGN_LAB_DAILY_CAP } : null;
}
