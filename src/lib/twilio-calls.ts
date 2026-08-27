import "server-only";

// Live call log straight from Twilio's REST API - no local table to keep in
// sync, always accurate. We list recent calls, collapse the internal dial legs,
// and attach each call's recording. Recording audio is streamed through an
// authenticated admin route (Twilio media needs our credentials), never a
// public link.

export function twilioVoiceEnabled(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

export type CallRecord = {
  sid: string;
  direction: "inbound" | "outbound";
  otherParty: string; // the customer's number (from on inbound, to on outbound)
  ourNumber: string;
  status: string; // completed | no-answer | busy | failed | canceled | ...
  answered: boolean;
  startTime: string | null; // ISO
  durationSec: number;
  recordingSid?: string;
  recordingSec?: number;
};

function auth(): string {
  return "Basic " + Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
}

async function tw(path: string): Promise<Record<string, unknown> | null> {
  const acct = process.env.TWILIO_ACCOUNT_SID;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${acct}/${path}`, {
      headers: { Authorization: auth() },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Recent calls with recordings attached, newest first. Internal dial legs
 *  (a call with a parent) are collapsed into their parent so each row is one
 *  real conversation. */
export async function listRecentCalls(limit = 40): Promise<CallRecord[]> {
  if (!twilioVoiceEnabled()) return [];
  const [callsRes, recsRes] = await Promise.all([
    tw(`Calls.json?PageSize=${Math.min(limit * 2, 100)}`),
    tw(`Recordings.json?PageSize=100`),
  ]);
  const calls = (callsRes?.calls as any[]) ?? [];
  const recordings = (recsRes?.recordings as any[]) ?? [];

  // recording by the call sid it was captured on
  const recByCall = new Map<string, { sid: string; duration: number }>();
  for (const r of recordings) recByCall.set(r.call_sid, { sid: r.sid, duration: Number(r.duration) || 0 });

  // child dial legs grouped by parent, so a parent can inherit a leg's recording
  const childrenByParent = new Map<string, any[]>();
  for (const c of calls) {
    if (c.parent_call_sid) {
      const arr = childrenByParent.get(c.parent_call_sid) ?? [];
      arr.push(c);
      childrenByParent.set(c.parent_call_sid, arr);
    }
  }

  const out: CallRecord[] = [];
  for (const c of calls) {
    if (c.parent_call_sid) continue; // collapse legs into the parent row
    const inbound = c.direction === "inbound";
    // Find a recording on this call or any of its dial legs.
    let rec = recByCall.get(c.sid);
    if (!rec) {
      for (const child of childrenByParent.get(c.sid) ?? []) {
        const cr = recByCall.get(child.sid);
        if (cr) { rec = cr; break; }
      }
    }
    out.push({
      sid: c.sid,
      direction: inbound ? "inbound" : "outbound",
      otherParty: inbound ? c.from : c.to,
      ourNumber: inbound ? c.to : c.from,
      status: c.status,
      answered: c.status === "completed" && (Number(c.duration) || 0) > 0,
      startTime: c.start_time ? new Date(c.start_time).toISOString() : null,
      durationSec: Number(c.duration) || 0,
      recordingSid: rec?.sid,
      recordingSec: rec?.duration,
    });
  }
  return out.slice(0, limit);
}

/** Fetch one recording's MP3 bytes (authenticated) for the admin audio proxy. */
export async function getRecordingMedia(sid: string): Promise<{ buf: Buffer; contentType: string } | null> {
  if (!twilioVoiceEnabled()) return null;
  const acct = process.env.TWILIO_ACCOUNT_SID;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${acct}/Recordings/${sid}.mp3`, {
      headers: { Authorization: auth() },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return { buf: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get("content-type") || "audio/mpeg" };
  } catch {
    return null;
  }
}
