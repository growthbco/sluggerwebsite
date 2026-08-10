"use client";

import { useState } from "react";
import reviewsData from "@/data/reviews.json";

// Our own reviews section (replaces the GHL-hosted LeadConnector widget so
// canceling GHL doesn't blank the homepage). Reviews were exported from the
// old widget's data on Aug 10, 2026 - src/data/reviews.json is the source of
// truth; append new ones there. The aggregate (4.9 / 79) counts EVERY review
// on record; the grid shows the 5-star ones with written comments.
const INITIAL_SHOWN = 9;

const Stars = ({ n }: { n: number }) => (
  <span className="text-brand tracking-tight" aria-label={`${n} out of 5 stars`}>
    {"★".repeat(n)}
    <span className="text-line">{"★".repeat(5 - n)}</span>
  </span>
);

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "long", year: "numeric" });

export function ReviewsSection() {
  const [showAll, setShowAll] = useState(false);
  const reviews = reviewsData.reviews
    .filter((r) => r.stars === 5 && r.comment.trim().length > 0)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const shown = showAll ? reviews : reviews.slice(0, INITIAL_SHOWN);

  return (
    <div>
      <div className="flex items-center justify-center gap-3 text-foreground">
        <span className="display text-4xl">{reviewsData.totalRating.toFixed(1)}</span>
        <div>
          <Stars n={5} />
          <p className="text-xs text-muted">{reviewsData.totalReviews} customer reviews</p>
        </div>
      </div>

      <div className="mt-8 columns-1 sm:columns-2 lg:columns-3 gap-4 [&>*]:break-inside-avoid">
        {shown.map((r, i) => (
          <figure key={i} className="mb-4 bg-steel border border-line p-5">
            <Stars n={r.stars} />
            <blockquote className="mt-2 text-sm text-foreground/90 whitespace-pre-line">{r.comment}</blockquote>
            <figcaption className="mt-3 text-xs text-muted">
              <span className="display text-foreground">{r.name}</span> · {fmtDate(r.date)}
            </figcaption>
          </figure>
        ))}
      </div>

      {!showAll && reviews.length > INITIAL_SHOWN && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="display text-sm text-brand border border-brand/40 px-5 py-2.5 hover:bg-brand/10"
          >
            Show all {reviews.length} reviews
          </button>
        </div>
      )}
    </div>
  );
}
