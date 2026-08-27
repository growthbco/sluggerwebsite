import { recordAiUsage } from "@/lib/ai-usage";

const API_URL = "https://api.openai.com/v1/responses";
export const OPENAI_VISION_MODEL = process.env.OPENAI_VISION_MODEL || "gpt-5-mini";

export type OpenAiInputPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail?: "low" | "high" | "auto" }
  | { type: "input_file"; filename: string; file_data: string };

type StructuredOptions = {
  operation: string;
  schemaName: string;
  schema: Record<string, unknown>;
  parts: OpenAiInputPart[];
  timeoutMs?: number;
  metadata?: Record<string, string | number | boolean | null>;
};

function outputText(data: unknown): string {
  const response = data as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ type?: string; text?: unknown }> }>;
  } | null;
  if (typeof response?.output_text === "string") return response.output_text;
  for (const item of response?.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return "";
}

function usage(data: unknown) {
  const value = (data as { usage?: Record<string, unknown> } | null)?.usage;
  const number = (input: unknown) => typeof input === "number" ? input : null;
  return {
    inputTokens: number(value?.input_tokens),
    outputTokens: number(value?.output_tokens),
    totalTokens: number(value?.total_tokens),
  };
}

/** Call OpenAI's Responses API with strict structured output. */
export async function generateOpenAiStructured<T>(options: StructuredOptions): Promise<T> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured");

  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_VISION_MODEL,
        input: [{ role: "user", content: options.parts }],
        text: {
          format: {
            type: "json_schema",
            name: options.schemaName,
            strict: true,
            schema: options.schema,
          },
        },
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 120000),
    });
  } catch (error) {
    await recordAiUsage({
      provider: "openai",
      model: OPENAI_VISION_MODEL,
      operation: options.operation,
      status: "error",
      metadata: { ...options.metadata, error: error instanceof Error ? error.name : "unknown" },
    });
    throw error;
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    await recordAiUsage({
      provider: "openai",
      model: OPENAI_VISION_MODEL,
      operation: options.operation,
      status: "error",
      metadata: { ...options.metadata, httpStatus: response.status },
    });
    console.error(`OpenAI ${options.operation} failed:`, response.status, detail.slice(0, 400));
    throw new Error(`AI request failed (${response.status})`);
  }

  const data = await response.json();
  const text = outputText(data);
  if (!text) {
    await recordAiUsage({
      provider: "openai",
      model: OPENAI_VISION_MODEL,
      operation: options.operation,
      status: "refused",
      metadata: options.metadata,
      ...usage(data),
    });
    throw new Error("AI returned no structured output");
  }

  try {
    const parsed = JSON.parse(text) as T;
    await recordAiUsage({
      provider: "openai",
      model: OPENAI_VISION_MODEL,
      operation: options.operation,
      status: "success",
      metadata: options.metadata,
      ...usage(data),
    });
    return parsed;
  } catch (error) {
    await recordAiUsage({
      provider: "openai",
      model: OPENAI_VISION_MODEL,
      operation: options.operation,
      status: "error",
      metadata: { ...options.metadata, error: "invalid_json" },
      ...usage(data),
    });
    throw error;
  }
}
