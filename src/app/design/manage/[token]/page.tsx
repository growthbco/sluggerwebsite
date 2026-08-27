import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { dbEnabled } from "@/db";
import { getByManageToken } from "@/lib/design-requests";
import { getByDesignRequestId } from "@/lib/team-orders";
import { JERSEY_MATERIALS, itemLabel, notDesignerMade } from "@/lib/order-items";
import { DesignMessages } from "@/components/design-messages";
import { DesignProgress } from "@/components/design-progress";
import { getAdminSession } from "@/lib/admin-auth";

export const metadata: Metadata = { title: "Design Status", robots: { index: false } };

function Centered({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 py-24 text-center">
      <h1 className="display text-3xl text-foreground">{title}</h1>
      <p className="mt-3 text-muted">{children}</p>
    </div>
  );
}

// Client-facing status view for a design request. Staff/designer tools (proof
// upload, AI studio, mark-approved, SMS) now live in the admin workspace at
// /admin/design-requests/[id] - so any logged-in staff hitting this link is
// sent straight there. Non-admins get the stepper, their proofs, and the
// message thread only.
export default async function ManageDesignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!dbEnabled()) return <Centered title="Not available yet">Design requests aren&apos;t turned on yet.</Centered>;

  const request = await getByManageToken(token);
  if (!request) return <Centered title="Link not found">This management link is invalid or has expired.</Centered>;

  // Logged-in staff/designer -> full workspace in admin chrome.
  const adminSession = await getAdminSession();
  if (adminSession) redirect(`/admin/design-requests/${request.id}`);

  const linkedOrder = await getByDesignRequestId(request.id);

  // Read-only proof gallery: approved first, then any other sent proofs.
  const approved = request.approvedDesignUrls ?? (request.approvedDesignUrl ? [request.approvedDesignUrl] : []);
  const otherProofs = (request.proofImages ?? []).filter((u) => !approved.includes(u));
  const labels = request.proofLabels ?? {};

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-14 space-y-10">
      <DesignProgress
        status={request.status}
        orderStatus={linkedOrder?.status}
        orderReference={linkedOrder?.reference}
        orderSpec={
          linkedOrder
            ? [
                linkedOrder.jerseyStyle,
                linkedOrder.jerseyMaterial
                  ? JERSEY_MATERIALS.find((m) => m.key === linkedOrder.jerseyMaterial)?.label ?? linkedOrder.jerseyMaterial
                  : null,
                (linkedOrder.items ?? []).filter((k) => !notDesignerMade(k)).map(itemLabel).join(" + "),
              ]
                .filter(Boolean)
                .join(" · ")
            : null
        }
        printFileVerified={Boolean(linkedOrder?.printFileVerifiedAt)}
      />

      {(approved.length > 0 || otherProofs.length > 0) && (
        <section>
          <h2 className="display text-xl text-foreground">Your designs</h2>
          {approved.length > 0 && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {approved.map((u, i) => (
                <div key={u} className="border border-green-500 bg-steel">
                  <a href={u} target="_blank" rel="noopener noreferrer" className="relative aspect-[4/3] bg-white overflow-hidden block">
                    <Image src={u} alt={labels[u] || `Approved design ${i + 1}`} fill sizes="33vw" className="object-contain p-1" unoptimized />
                    <span className="absolute top-1 left-1 bg-green-600 text-white display text-[10px] px-1.5 py-0.5">APPROVED</span>
                  </a>
                  {labels[u] && <div className="px-2 py-1.5 text-sm text-foreground">{labels[u]}</div>}
                </div>
              ))}
            </div>
          )}
          {otherProofs.length > 0 && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {otherProofs.map((u, i) => (
                <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="relative aspect-square bg-white border border-line overflow-hidden block">
                  <Image src={u} alt={labels[u] || `Proof ${i + 1}`} fill sizes="25vw" className="object-contain p-1" unoptimized />
                </a>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="pt-6 border-t border-line">
        <DesignMessages token={token} role="client" initialMessages={request.messages ?? []} status={request.status} />
      </div>
    </div>
  );
}
