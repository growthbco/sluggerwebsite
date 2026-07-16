import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

export const runtime = "nodejs";

// Token route for client-side direct uploads to Vercel Blob.
// Used by the design intake form to upload inspiration images, and by the
// designer manage page to upload proof images. Restricts to images and a
// reasonable max size.
const ALLOWED = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf", // designs sometimes shared as PDF
];

export async function POST(req: Request): Promise<NextResponse> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Uploads aren't configured yet (missing BLOB_READ_WRITE_TOKEN)." },
      { status: 503 },
    );
  }

  const body = (await req.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => ({
        // Public access so we can display proofs/inspiration without auth headers.
        access: "public",
        allowedContentTypes: ALLOWED,
        maximumSizeInBytes: 100 * 1024 * 1024, // 100 MB per file (high-res print PDFs)
        addRandomSuffix: true,
        // Namespace uploads by section.
        tokenPayload: JSON.stringify({ pathname }),
      }),
      // No post-upload bookkeeping needed; the design-request create/proof
      // endpoints persist the returned URLs.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(json);
  } catch (e) {
    console.error("Blob upload error:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
