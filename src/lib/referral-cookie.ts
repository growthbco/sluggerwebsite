import { cookies } from "next/headers";

/**
 * Read the referral code stashed by the /r/<code> link, if any. Returns a
 * cleaned uppercase code or undefined. Call only inside a request scope.
 */
export async function refCodeFromCookie(): Promise<string | undefined> {
  try {
    const c = (await cookies()).get("slugger_ref")?.value;
    const clean = (c || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
    return clean || undefined;
  } catch {
    return undefined;
  }
}
