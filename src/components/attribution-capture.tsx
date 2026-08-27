"use client";

import { useEffect } from "react";

/** First-touch attribution: on a visitor's first page view, remember where
 *  they came from (referrer + UTM params + landing page) in a 90-day cookie.
 *  Never overwritten, so the ORIGINAL source survives later direct visits.
 *  Read server-side when an order / design request is created. */
export function AttributionCapture() {
  useEffect(() => {
    try {
      if (document.cookie.includes("slugger_attr=")) return; // first touch wins
      // Private / functional links (a portal magic link, a design status page, a
      // team-order manage link, a store, checkout) are NOT marketing sources - a
      // customer following one is not a fresh lead, and the link's token must
      // never end up recorded as their attribution.
      if (/^\/(portal|design|team-order|store|admin|checkout|r)\//.test(window.location.pathname)) return;
      const p = new URLSearchParams(window.location.search);
      let refHost = "";
      try {
        refHost = document.referrer ? new URL(document.referrer).hostname : "";
      } catch {}
      // Internal navigation isn't a source.
      if (refHost && refHost.replace(/^www\./, "") === window.location.hostname.replace(/^www\./, "")) refHost = "";
      const data = {
        r: refHost,
        s: p.get("utm_source") ?? "",
        m: p.get("utm_medium") ?? "",
        c: p.get("utm_campaign") ?? "",
        g: p.get("gclid") ? 1 : 0, // Google Ads click
        f: p.get("fbclid") ? 1 : 0, // Facebook/Instagram ad click
        l: window.location.pathname,
      };
      document.cookie = `slugger_attr=${encodeURIComponent(JSON.stringify(data))}; path=/; max-age=${60 * 60 * 24 * 90}; SameSite=Lax`;
    } catch {
      /* attribution is best-effort - never break the page over it */
    }
  }, []);
  return null;
}
