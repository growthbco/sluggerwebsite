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
      {status === "changes_requested" && (
        <p className="mt-2 text-xs text-amber-400">
          ✏️ Client requested changes - the ball is with the designer for an updated proof.
        </p>
      )}
      {status === "pending_payment" && (
        <p className="mt-2 text-xs text-amber-400">⏳ Waiting on the design fee before work starts.</p>
      )}
      {rosterIn && !printFileVerified && (
        <p className="mt-2 text-xs text-amber-400">
          🖨 Next: upload the print file below - the AI check against the roster must pass before production.
        </p>
      )}
      {printFileVerified && (
        <p className="mt-2 text-xs text-green-400">✓ Print file verified against the roster - clear for production.</p>
      )}
      {orderSpec && (
        <p className="mt-2 text-xs text-foreground">
          👕 Making: <strong className="text-brand">{orderSpec}</strong>
        </p>
      )}
      {orderStatus && (
        <p className="mt-2 text-xs text-foreground">
          🧾 Team order{orderReference ? ` ${orderReference}` : ""}:{" "}
          <strong className="text-brand">
            {orderStatus === "submitted" && !printFileVerified
              ? "Roster submitted - print file QA is the next step"
              : orderStatus === "submitted" && printFileVerified
              ? "Print file verified - ready to send the deposit invoice"
              : ORDER_LABELS[orderStatus] ?? orderStatus}
          </strong>
        </p>
      )}
      {(status === "approved" || status === "ordered") && !orderStatus && (
        <p className="mt-2 text-xs text-foreground">
          ✅ Design is <strong className="text-green-400">APPROVED</strong> - no team order started yet.
        </p>
      )}
    </div>
  );
}
