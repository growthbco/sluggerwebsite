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
