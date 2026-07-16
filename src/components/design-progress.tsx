// Pipeline strip for the design manage page: shows exactly where this project
// is so staff never have to ask the client (or guess) the status. Rendered
// right above the message box, where staff actually work.

const DESIGN_STEPS = [
  { key: "submitted", label: "Submitted" },
  { key: "in_design", label: "In Design" },
  { key: "proof_sent", label: "Proof Sent" },
  { key: "approved", label: "APPROVED" },
  { key: "roster_in", label: "Roster In" },
  { key: "print_qa", label: "Print File QA" },
];

const ORDER_LABELS: Record<string, string> = {
  draft: "Roster: not started",
  collecting: "Roster: collecting players",
  submitted: "Roster submitted - awaiting deposit invoice",
  quoted: "Deposit invoice sent - awaiting payment",
  in_production: "Deposit paid - IN PRODUCTION",
  paid: "PAID IN FULL - ready to ship",
  shipped: "SHIPPED",
  cancelled: "Order cancelled",
};

export function DesignProgress({
  status,
  orderStatus,
  orderReference,
  orderSpec,
  printFileVerified,
}: {
  status: string;
  orderStatus?: string | null;
  orderReference?: string | null;
  /** What's being made: jersey style, material, items. */
  orderSpec?: string | null;
  printFileVerified?: boolean;
}) {
  if (status === "cancelled") {
    return (
      <div className="bg-steel border border-line px-4 py-3 text-sm text-muted">
        This design request was <strong className="text-foreground">cancelled</strong>.
      </div>
    );
  }

  // changes_requested is a loop back to the designer between proof and approval.
  const effective = status === "changes_requested" ? "proof_sent" : status === "pending_payment" ? "submitted" : status;
  const rosterIn = Boolean(orderStatus && !["draft", "collecting", "cancelled"].includes(orderStatus));

  // The last two steps are operational, not design-status driven: the roster
  // landing, then the print file passing AI verification before production.
  let currentIdx: number;
  if (printFileVerified) {
    currentIdx = DESIGN_STEPS.length; // everything done
  } else if (rosterIn) {
    currentIdx = 5; // waiting on print file + QA
  } else if (effective === "ordered" || effective === "approved") {
    currentIdx = 4; // approved; waiting on the roster
  } else {
    currentIdx = Math.max(0, DESIGN_STEPS.findIndex((s) => s.key === effective));
  }

  return (
    <div className="bg-steel border border-line p-4">
      <p className="display text-sm text-muted mb-3">Where this project is</p>
      <ol className="flex flex-wrap items-center gap-y-2">
        {DESIGN_STEPS.map((s, i) => {
          const done = i < currentIdx;
          const current = i === currentIdx;
          return (
            <li key={s.key} className="flex items-center">
              <span
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs display border ${
                  current
                    ? "bg-brand text-on-brand border-brand"
                    : done
                    ? "border-green-500/50 text-green-400"
                    : "border-line text-muted"
                }`}
              >
                {done ? "✓ " : ""}
                {s.label}
              </span>
              {i < DESIGN_STEPS.length - 1 && <span className="mx-1.5 text-muted">→</span>}
            </li>
          );
        })}
      </ol>
      {/* The facts: what's being made + the order's plain state. */}
      {(orderSpec || orderStatus || (!orderStatus && (status === "approved" || status === "ordered"))) && (
        <div className="mt-3 pt-3 border-t border-line/60 space-y-1 text-xs text-foreground">
          {orderSpec && (
            <p>
              👕 Making: <strong className="text-foreground">{orderSpec}</strong>
            </p>
          )}
          {orderStatus ? (
            <p>
              🧾 Order{orderReference ? ` ${orderReference}` : ""}:{" "}
              <span className="text-muted">
                {orderStatus === "submitted"
                  ? printFileVerified
                    ? "roster in, print file verified"
                    : "roster in"
                  : ORDER_LABELS[orderStatus] ?? orderStatus}
              </span>
            </p>
          ) : (
            (status === "approved" || status === "ordered") && (
              <p className="text-muted">🧾 Design approved - no team order started yet.</p>
            )
          )}
        </div>
      )}

      {/* The one thing to do next. */}
      {status === "changes_requested" && (
        <p className="mt-3 text-sm text-amber-400">
          ⏭ <strong>Next:</strong> send the client an updated proof (they requested changes).
        </p>
      )}
      {status === "pending_payment" && (
        <p className="mt-3 text-sm text-amber-400">
          ⏭ <strong>Next:</strong> waiting on the design fee before work starts.
        </p>
      )}
      {rosterIn && !printFileVerified && (
        <p className="mt-3 text-sm text-amber-400">
          ⏭ <strong>Next:</strong> upload the print file below and run the AI check.
        </p>
      )}
      {printFileVerified && orderStatus === "submitted" && (
        <p className="mt-3 text-sm text-green-400">
          ⏭ <strong>Next:</strong> print file passed - send the deposit invoice from the dashboard.
        </p>
      )}
    </div>
  );
}
