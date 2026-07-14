import { NextResponse } from "next/server";
import { parseRoster } from "@/lib/roster-parser";

export const runtime = "nodejs";

const MAX_TEXT = 20_000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

// Parse a pasted/photographed roster into rows. Read-only helper: the result
// goes into an editable preview the coach must confirm - nothing is saved here.
export async function POST(req: Request) {
  let text = "";
  let itemKeys: string[] = ["jersey"];
  let image: { mime: string; base64: string } | undefined;

  try {
    const form = await req.formData();
    text = String(form.get("text") ?? "").slice(0, MAX_TEXT);
    try {
      const items = JSON.parse(String(form.get("items") ?? "[]"));
      if (Array.isArray(items) && items.length) itemKeys = items.map(String).slice(0, 10);
    } catch {}
    const file = form.get("image");
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: "Photo is too large (max 8MB)." }, { status: 400 });
      }
      if (!/^image\//.test(file.type)) {
        return NextResponse.json({ error: "Only image files are supported." }, { status: 400 });
      }
      const buf = Buffer.from(await file.arrayBuffer());
      image = { mime: file.type, base64: buf.toString("base64") };
    }
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!text.trim() && !image) {
    return NextResponse.json({ error: "Paste your roster or add a photo first." }, { status: 400 });
  }

  try {
    const rows = await parseRoster({ text: text.trim() || undefined, image, itemKeys });
    if (rows.length === 0) {
      return NextResponse.json({ error: "Couldn't find any players in that - try a clearer photo or paste the list as text." }, { status: 422 });
    }
    return NextResponse.json({ ok: true, rows });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
