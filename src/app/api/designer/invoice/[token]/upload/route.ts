import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { isValidDesignerToken } from "@/lib/designer-invoices";

export const runtime = "nodejs";

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB is plenty for an invoice PDF/photo
const OK_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/heic"];

// The print vendor attaches their OWN invoice file (PDF or photo) to a
// submission. Token-gated; stored on Vercel Blob; the URL is sent back and the
// vendor form includes it on submit.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isValidDesignerToken(token)) return NextResponse.json({ error: "Invalid link" }, { status: 401 });

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
  } catch {}
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File is too large (max 15 MB)." }, { status: 400 });
  if (file.type && !OK_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Please upload a PDF or an image." }, { status: 400 });
  }

  const safeName = (file.name || "invoice").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80);
  try {
    const blob = await put(`designer-invoices/vendor/${safeName}`, file, {
      access: "public",
      contentType: file.type || "application/octet-stream",
      addRandomSuffix: true,
    });
    return NextResponse.json({ ok: true, url: blob.url, name: file.name || "invoice" });
  } catch (e) {
    console.error("vendor invoice upload failed:", e);
    return NextResponse.json({ error: "Upload failed - try again." }, { status: 500 });
  }
}
