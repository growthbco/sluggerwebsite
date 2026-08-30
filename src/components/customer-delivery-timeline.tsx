import Link from "next/link";
import {
  formatRequestedDate,
  formatTimelineDate,
  type DeliveryTimeline,
} from "@/lib/delivery-timeline";

export function CustomerDeliveryTimeline({
  timeline,
  localPickup = false,
  shippedAt,
}: {
  timeline: DeliveryTimeline;
  localPickup?: boolean;
  shippedAt?: Date | string | null;
}) {
  const shipped = shippedAt ? new Date(shippedAt) : null;
  const hasValidShippedDate = shipped && !Number.isNaN(shipped.getTime());
  const targetLabel = localPickup ? "Pickup target" : "Ready-to-ship target";
  const arrivalTargetAt = timeline.promisedInHandAt
    ?? (timeline.tier !== "standard" ? timeline.requestedInHandAt : null);
  const arrivalTargetDate = arrivalTargetAt
    ? formatRequestedDate(arrivalTargetAt)
    : null;
  const requestedMatchesTarget = Boolean(
    timeline.requestedInHandAt
      && arrivalTargetAt
      && timeline.requestedInHandAt.getTime() === arrivalTargetAt.getTime(),
  );
  const startLabel = timeline.startManual
    ? "Recorded production start"
    : timeline.startEstimated
      ? "Production start on file"
      : "Production started";

  return (
    <section className="rounded-xl border-2 border-brand/60 bg-brand/[0.06] p-5" aria-labelledby="delivery-timeline-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="display text-xs uppercase tracking-[0.16em] text-brand">Delivery timeline</p>
          <h2 id="delivery-timeline-heading" className="display text-2xl text-foreground mt-1">
            {hasValidShippedDate
              ? `${localPickup ? "Picked up" : "Shipped"} ${formatTimelineDate(shipped)}`
              : arrivalTargetDate
                ? `Target arrival: ${arrivalTargetDate}`
              : timeline.selectedTargetAt
                ? `${targetLabel}: ${formatTimelineDate(timeline.selectedTargetAt)}`
                : "Waiting for the production clock to start"}
          </h2>
        </div>
        <span className="rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-xs display text-brand">
          {timeline.tierLabel}
        </span>
      </div>

      {timeline.startAt ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="border border-line bg-ink/40 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-muted">{startLabel}</p>
            <p className="display text-lg text-foreground mt-0.5">{formatTimelineDate(timeline.startAt)}</p>
          </div>
          {arrivalTargetAt ? (
            <div className="border border-brand/50 bg-brand/10 px-4 py-3">
              <p className="text-xs uppercase tracking-wider text-brand">Target arrival</p>
              <p className="display text-lg text-foreground mt-0.5">{arrivalTargetDate}</p>
              <p className="text-xs text-muted mt-1">We&apos;re working toward this date; carrier delivery dates remain estimates.</p>
            </div>
          ) : (
            <div className="border border-line bg-ink/40 px-4 py-3">
              <p className="text-xs uppercase tracking-wider text-muted">{targetLabel}</p>
              <p className="display text-lg text-foreground mt-0.5">{formatTimelineDate(timeline.selectedTargetAt)}</p>
            </div>
          )}
          {timeline.requestedInHandAt && !requestedMatchesTarget ? (
            <div className="border border-line bg-ink/40 px-4 py-3">
              <p className="text-xs uppercase tracking-wider text-muted">Requested in hand</p>
              <p className="display text-lg text-foreground mt-0.5">{formatRequestedDate(timeline.requestedInHandAt)}</p>
              {!timeline.promisedInHandAt ? <p className="text-xs text-muted mt-1">A request, not a confirmed delivery date.</p> : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 border border-line bg-ink/40 px-4 py-3">
          <p className="text-sm text-foreground">Production begins after the final design, final roster, and deposit are complete.</p>
          {timeline.missing.length > 0 ? (
            <p className="text-xs text-muted mt-1">Still needed: {timeline.missing.join(", ")}.</p>
          ) : null}
        </div>
      )}

      <p className="mt-4 text-xs text-muted">
        {localPickup
          ? hasValidShippedDate
            ? "Pickup is complete. Your seven-day inspection window begins from the recorded handoff time."
            : "We will contact you when the order is ready for pickup in Ocala."
          : arrivalTargetAt
            ? `We are producing and shipping this order toward the ${arrivalTargetDate} arrival target. Tracking will show the carrier's latest estimate once the package is on its way.`
            : "The production target is when we expect the order to be ready to ship. Carrier transit comes afterward, and tracking will show the delivery estimate once the final package is on its way."}
        {!localPickup ? (
          <>
            {" "}
            <Link href="/shipping" className="inline-flex min-h-11 items-center text-brand underline underline-offset-2 hover:text-brand-light">
              Read our Shipping &amp; Delivery policy.
            </Link>
          </>
        ) : null}
      </p>
    </section>
  );
}
