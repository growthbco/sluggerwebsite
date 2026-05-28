"use client";

import { useEffect } from "react";

// Embeds Slugger Athletics' own reputation review widget (LeadConnector).
// The script auto-resizes the iframe to fit its content.
export function ReviewWidget() {
  useEffect(() => {
    const SRC = "https://team.sluggerathletics.com/reputation/assets/review-widget.js";
    if (document.querySelector(`script[src="${SRC}"]`)) return;
    const s = document.createElement("script");
    s.src = SRC;
    s.type = "text/javascript";
    s.async = true;
    document.body.appendChild(s);
  }, []);

  return (
    <iframe
      className="lc_reviews_widget"
      src="https://team.sluggerathletics.com/reputation/widgets/review_widget/JdFxW4B9mo9YfNNOhzIk?widgetId=6a171a00190e7ebd301d64c3"
      frameBorder={0}
      scrolling="no"
      style={{ minWidth: "100%", width: "100%" }}
      title="Slugger Athletics customer reviews"
    />
  );
}
