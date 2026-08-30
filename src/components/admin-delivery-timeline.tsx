import { CopyTextButton } from "@/components/copy-text-button";
import {
  buildDeliveryTimeline,
  customerTimelineMessage,
  formatRequestedDate,
  formatTimelineDate,
  type DeliveryTimelineInput,
} from "@/lib/delivery-timeline";

const RISK_STYLE = {
  no_date: "border-line text-muted",
  waiting: "border-amber-300/50 text-amber-300",
  on_track: "border-green-400/50 text-green-400",
  tight: "border-amber-300/50 text-amber-300",
  rush_needed: "border-orange-400/50 text-orange-300",
  priority_review: "border-red-400/50 text-red-300",
  not_feasible: "border-red-500/60 text-red-400",
} as const;

type Props = DeliveryTimelineInput & {
  contactName?: string | null;
};

function DateBox({ label, value, note, active }: { label: string; value: Date | null; note: string; active?: boolean }) {
  return (
    <div className={`border px-3 py-3 ${active ? "border-brand/60 bg-brand/[0.07]" : "border-line bg-ink/30"}`}>
      <p className="text-xs display uppercase tracking-wide text-muted">{label}</p>
      <p className="display text-lg text-foreground mt-0.5">{formatTimelineDate(value)}</p>
      <p className="text-xs text-muted mt-1">{note}</p>
    </div>
  );
}

export function AdminDeliveryTimeline(props: Props) {
  const timeline = buildDeliveryTimeline(props);
  const update = customerTimelineMessage({ firstName: props.contactName, localPickup: props.localPickup, timeline });

  return (
    <section className="bg-steel border border-line rounded-xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs display uppercase tracking-[0.16em] text-brand">Customer promise</p>
          <h2 className="display text-xl text-foreground mt-0.5">Delivery timeline</h2>
          <p className="text-sm text-muted mt-1">The clock starts after approval, final roster, and deposit are all complete.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-xs display border border-brand/50 bg-brand/5 px-2.5 py-1 text-brand">{timeline.tierLabel}</span>
          <span className={`text-xs display border px-2.5 py-1 ${RISK_STYLE[timeline.risk]}`}>{timeline.riskLabel}</span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DateBox
          label={timeline.startManual || timeline.startEstimated ? "Recorded start" : "Clock started"}
          value={timeline.startAt}
          note={timeline.startManual
            ? "Manual timeline override"
            : timeline.startEstimated
            ? `Legacy estimate; missing ${timeline.missing.join(", ")} timestamp`
            : timeline.startAt
              ? "Latest completed requirement"
              : `Waiting: ${timeline.missing.join(", ")}`}
        />
        <DateBox label="Standard" value={timeline.standardTargetAt} note="3-week production target" active={timeline.tier === "standard"} />
        <DateBox label="Rush" value={timeline.rushTargetAt} note="$100 · 2-week target · confirm first" active={timeline.tier === "rush"} />
        <DateBox label="Priority · internal" value={timeline.priorityTargetAt} note="1-week target · manual premium + approval" active={timeline.tier === "priority"} />
      </div>

      <div className={`mt-3 border px-4 py-3 ${RISK_STYLE[timeline.risk]}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="display">{timeline.riskLabel}</p>
          <p className="text-sm">Requested in hand: {formatRequestedDate(timeline.requestedInHandAt)}</p>
        </div>
        {timeline.promisedInHandAt ? <p className="text-sm mt-1 font-semibold">Promised in writing: {formatRequestedDate(timeline.promisedInHandAt)}</p> : null}
        <p className="text-sm mt-1 opacity-90">{timeline.riskDetail}</p>
      </div>

      <div className="mt-4 border-t border-line/60 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs display uppercase tracking-wide text-muted">Ready-to-send update</p>
          <CopyTextButton text={update} />
        </div>
        <p className="mt-2 whitespace-pre-wrap border border-line bg-ink/40 p-3 text-sm leading-6 text-foreground/90">{update}</p>
        <p className="mt-2 text-xs text-muted">
          {props.localPickup
            ? "Production target only. A different pickup date controls only when it was separately confirmed in writing."
            : "Production target only. Shipping time is additional unless a written in-hand date was separately confirmed."}
        </p>
      </div>
    </section>
  );
}
