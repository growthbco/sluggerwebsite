import type { CustomerOrderSpec } from "@/lib/order-spec";

const money = (cents: number) => `$${(cents / 100).toLocaleString("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

export function OrderSpecificationCard({ spec, compact = false }: { spec: CustomerOrderSpec; compact?: boolean }) {
  const productDetails = [spec.products.join(" + "), spec.jerseyStyle, spec.jerseyMaterial]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="rounded-lg border border-brand/60 bg-brand/[0.06] p-4 sm:p-5" aria-labelledby="order-specification-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="display text-xs uppercase tracking-[0.16em] text-brand">Order specification</p>
          <h2 id="order-specification-title" className="display mt-1 text-xl text-foreground">What Slugger will make</h2>
          <p className="mt-1 text-sm text-muted">{productDetails}</p>
        </div>
        <span className="rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-xs text-brand">{spec.serviceLevel}</span>
      </div>

      <dl className={`mt-4 grid gap-3 text-sm ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        <SpecItem term="Team" value={spec.teamName} />
        <SpecItem term="Quantity" value={`${spec.athleteCount} athletes · ${spec.pieceCount} pieces`} />
        <SpecItem term="Production" value={spec.productionWindow} />
        {spec.colors && <SpecItem term="Colors" value={spec.colors} />}
        {spec.designs.length > 0 && <SpecItem term="Approved artwork" value={spec.designs.map((design) => design.label).join(" · ")} />}
        <SpecItem term="Requested in-hand date" value={spec.requestedInHandDate ?? "None provided"} />
        <SpecItem term="Delivery" value={spec.deliveryMethod ?? "Ship directly to me"} />
      </dl>

      {spec.sizes.length > 0 && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="display text-sm text-foreground">Size totals</p>
          <div className="mt-2 space-y-2 text-sm">
            {spec.sizes.map((group) => (
              <p key={group.label} className="text-muted">
                <span className="text-foreground">{group.label}:</span>{" "}
                {group.parts.map((part) => `${part.quantity} ${part.size}`).join(" · ")}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 border-t border-line pt-4">
        <div className="space-y-2 text-sm">
          {spec.priceLines.map((line, index) => (
            <div key={`${line.label}-${index}`} className="flex justify-between gap-4">
              <span className="text-muted">{line.label} · {line.quantity} × {money(line.unitPriceCents)}</span>
              <span className="text-foreground">{money(line.totalCents)}</span>
            </div>
          ))}
          {spec.rushFeeCents > 0 && <PriceRow label="Rush production fee" cents={spec.rushFeeCents} />}
          {spec.priorityFeeCents > 0 && <PriceRow label="Priority production premium" cents={spec.priorityFeeCents} />}
        </div>
        <div className="mt-3 flex items-end justify-between gap-4 border-t border-line pt-3">
          <div>
            <p className="display text-foreground">Merchandise subtotal</p>
            <p className="mt-0.5 text-xs text-muted">{spec.taxAndShipping}</p>
          </div>
          <span className="display text-2xl text-foreground">{money(spec.merchandiseSubtotalCents)}</span>
        </div>
      </div>
    </section>
  );
}

function SpecItem({ term, value }: { term: string; value: string }) {
  return (
    <div className="border-l-2 border-brand/40 pl-3">
      <dt className="text-xs uppercase tracking-wider text-muted">{term}</dt>
      <dd className="mt-0.5 text-foreground">{value}</dd>
    </div>
  );
}

function PriceRow({ label, cents }: { label: string; cents: number }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className="text-foreground">{money(cents)}</span>
    </div>
  );
}
