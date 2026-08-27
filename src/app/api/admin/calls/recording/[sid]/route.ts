import { isAdmin } from "@/lib/admin-auth";
import { getRecordingMedia } from "@/lib/twilio-calls";

export const runtime = "nodejs";

// Streams a Twilio call recording through our own auth so the admin <audio>
// player can play it. Twilio recording media requires account credentials, so
// this must never be a public link - admin session required, and the id is
// validated to a Twilio recording SID shape.
export async function GET(_req: Request, { params }: { params: Promise<{ sid: string }> }) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const { sid } = await params;
  if (!/^RE[0-9a-fA-F]{32}$/.test(sid)) return new Response("Bad request", { status: 400 });

  const media = await getRecordingMedia(sid);
  if (!media) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(media.buf), {
    headers: {
      "Content-Type": media.contentType,
      "Cache-Control": "private, max-age=3600",
      "Accept-Ranges": "bytes",
    },
  });
}
