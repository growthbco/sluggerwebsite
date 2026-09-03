"use client";

type Props = {
  localPickup: boolean;
  onChange: (localPickup: boolean) => void;
  disabled?: boolean;
  rushShipping?: boolean;
  name?: string;
};

/** Customer-facing delivery choice shared by the direct-order form, roster
 * review, and an existing order's delivery card. */
export function CustomerDeliveryChoice({
  localPickup,
  onChange,
  disabled = false,
  rushShipping = false,
  name = "delivery-method",
}: Props) {
  const options = [
    {
      pickup: false,
      title: "Ship directly to me",
      detail: rushShipping
        ? "Direct shipping is included with Rush. We will send tracking when the order is on its way."
        : "Shipping is calculated before your final payment. We will send tracking when the order is on its way.",
    },
    {
      pickup: true,
      title: "Free local pickup in Ocala",
      detail: "No shipping charge or delivery address. We will contact you when the order is ready for pickup.",
    },
  ];

  return (
    <fieldset disabled={disabled}>
      <legend className="display text-sm text-foreground">How would you like to receive the order?</legend>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const selected = localPickup === option.pickup;
          return (
            <label
              key={option.title}
              className={`flex min-h-24 cursor-pointer items-start gap-3 border p-4 transition-colors ${
                selected ? "border-brand bg-brand/[0.08]" : "border-line bg-ink/30 hover:border-brand/50"
              } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <input
                type="radio"
                name={name}
                checked={selected}
                onChange={() => onChange(option.pickup)}
                className="mt-1 h-4 w-4 shrink-0 accent-brand"
              />
              <span>
                <span className="display block text-sm text-foreground">{selected ? "✓ " : ""}{option.title}</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted">{option.detail}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
