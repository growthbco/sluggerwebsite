type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
};

/** Customer-facing delivery policy used at the final commitment point. Keep
 * this copy aligned with /shipping and /terms. */
export function DeliveryTimingAcknowledgment({ checked, onChange, id = "delivery-timing-ack" }: Props) {
  return (
    <div className="border border-amber-500/50 bg-amber-500/[0.07] p-4">
      <p className="display text-sm text-amber-300">Plan ahead for your season</p>
      <p className="mt-2 text-sm text-foreground/90">
        Fall is our busiest season. Production and carrier transit can take longer, so please order early and leave a buffer before your first game, event, or competition.
      </p>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-foreground/90">
        <li>Standard production is three weeks after final proof approval, final roster submission, and deposit payment. Shipping time is additional.</li>
        <li>
          Have a firm deadline? Ask us before ordering. A two-week rush is a flat <strong>$100</strong> fee and must be approved before production. Shorter deadlines require a separately priced priority review.
        </li>
        <li>
          Carrier, weather, customs, and routing delays are outside Slugger&apos;s control. We&apos;ll help track the package, but extra or upgraded shipping caused by a late order or carrier delay is the customer&apos;s responsibility unless we agree otherwise in writing.
        </li>
        <li>
          Customer tracking is for the final shipment to you. Tracking from a designer, factory, or supplier to Slugger is internal production tracking and is not shared on the customer order page.
        </li>
      </ul>
      <label htmlFor={id} className="mt-4 flex cursor-pointer select-none items-start gap-2.5 text-sm text-foreground">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
        />
        <span>
          I understand that my requested date is not guaranteed unless Slugger confirms it in writing, and that production and shipping are separate timelines. See the{" "}
          <a href="/shipping" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">Shipping &amp; Delivery policy</a>.
        </span>
      </label>
    </div>
  );
}
