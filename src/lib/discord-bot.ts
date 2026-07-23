// Discord bot actions that webhooks can't do (webhooks are post-only).
// Currently: archiving threads when work wraps up. Requires DISCORD_BOT_TOKEN
// from a bot invited with the "Manage Threads" permission; all calls no-op
// gracefully when the token isn't configured.

const API = "https://discord.com/api/v10";

export function discordBotEnabled(): boolean {
  return Boolean(process.env.DISCORD_BOT_TOKEN);
}

/** Archive a thread (forum post or channel thread). Returns false on any
 *  failure - archiving is cleanup, never worth failing a request over. */
export async function archiveDiscordThread(threadId: string | null | undefined): Promise<boolean> {
  if (!threadId || !discordBotEnabled()) return false;
  try {
    const res = await fetch(`${API}/channels/${threadId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ archived: true }),
    });
    if (!res.ok) {
      console.error("Discord thread archive failed:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("Discord thread archive error:", e);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Forum stage tags                                                    */
/* ------------------------------------------------------------------ */

// One tag per thread, reflecting where the project is in the pipeline.
// Threads become filterable in Discord's forum view by these tags.
export const STAGE_TAGS = [
  "🎨 Designing",
  "✅ Approved",
  "📋 Roster In",
  "💰 Deposit Paid",
  "💸 Paid in Full",
  "🚚 Shipped",
] as const;
export type StageTag = (typeof STAGE_TAGS)[number];

const botHeaders = () => ({
  Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
  "Content-Type": "application/json",
});

/** Set a forum thread's stage tag (replacing any previous stage tag).
 *  Auto-creates the tag on the forum if it doesn't exist yet (needs the bot
 *  to have Manage Channels; without it, pre-create the six STAGE_TAGS on the
 *  forum by hand once). Best-effort: never throws. */
export async function setThreadStageTag(threadId: string | null | undefined, tag: StageTag): Promise<boolean> {
  if (!threadId || !discordBotEnabled()) return false;
  try {
    // Thread -> parent forum channel.
    const threadRes = await fetch(`${API}/channels/${threadId}`, { headers: botHeaders() });
    if (!threadRes.ok) return false;
    const thread = (await threadRes.json()) as { parent_id?: string; applied_tags?: string[] };
    if (!thread.parent_id) return false;

    // Forum's available tags; create ours if missing.
    const forumRes = await fetch(`${API}/channels/${thread.parent_id}`, { headers: botHeaders() });
    if (!forumRes.ok) return false;
    const forum = (await forumRes.json()) as { available_tags?: { id: string; name: string }[] };
    let tags = forum.available_tags ?? [];
    let target = tags.find((t) => t.name === tag);
    if (!target) {
      const createRes = await fetch(`${API}/channels/${thread.parent_id}`, {
        method: "PATCH",
        headers: botHeaders(),
        body: JSON.stringify({ available_tags: [...tags.map((t) => ({ id: t.id, name: t.name })), { name: tag }] }),
      });
      if (!createRes.ok) {
        console.error("Discord tag create failed:", createRes.status, await createRes.text());
        return false;
      }
      const updated = (await createRes.json()) as { available_tags?: { id: string; name: string }[] };
      tags = updated.available_tags ?? [];
      target = tags.find((t) => t.name === tag);
      if (!target) return false;
    }

    // Replace any existing STAGE tag; keep unrelated tags the user added.
    const stageIds = new Set(tags.filter((t) => (STAGE_TAGS as readonly string[]).includes(t.name)).map((t) => t.id));
    const kept = (thread.applied_tags ?? []).filter((id) => !stageIds.has(id));
    const applyRes = await fetch(`${API}/channels/${threadId}`, {
      method: "PATCH",
      headers: botHeaders(),
      body: JSON.stringify({ applied_tags: [...kept, target.id].slice(0, 5) }),
    });
    if (!applyRes.ok) {
      console.error("Discord tag apply failed:", applyRes.status, await applyRes.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("Discord stage tag error:", e);
    return false;
  }
}
