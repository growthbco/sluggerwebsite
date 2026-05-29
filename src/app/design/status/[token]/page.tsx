import type { Metadata } from "next";
import { dbEnabled } from "@/db";
import { getByStatusToken } from "@/lib/design-requests";
import { DesignStatusPanel } from "@/components/design-status-panel";

export const metadata: Metadata = { title: "Your Design Request", robots: { index: false } };

function Centered({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 py-24 text-center">
      <h1 className="display text-3xl text-foreground">{title}</h1>
      <p className="mt-3 text-muted">{children}</p>
    </div>
  );
}

export default async function DesignStatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!dbEnabled()) return <Centered title="Not available yet">Design requests aren&apos;t turned on yet.</Centered>;

  const request = await getByStatusToken(token);
  if (!request) return <Centered title="Link not found">This link is invalid or has expired.</Centered>;

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-14">
      <DesignStatusPanel
        token={token}
        reference={request.reference}
        teamName={request.teamName}
        status={request.status}
        proofImages={request.proofImages ?? []}
        initialApprovedUrl={request.approvedDesignUrl}
        teamOrderUrl={`/team-order?design=${token}`}
      />
    </div>
  );
}
