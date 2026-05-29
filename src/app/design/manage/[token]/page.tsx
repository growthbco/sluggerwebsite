import type { Metadata } from "next";
import { dbEnabled } from "@/db";
import { getByManageToken } from "@/lib/design-requests";
import { DesignManagePanel } from "@/components/design-manage-panel";

export const metadata: Metadata = { title: "Manage Design Request", robots: { index: false } };

function Centered({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 py-24 text-center">
      <h1 className="display text-3xl text-foreground">{title}</h1>
      <p className="mt-3 text-muted">{children}</p>
    </div>
  );
}

export default async function ManageDesignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!dbEnabled()) return <Centered title="Not available yet">Design requests aren&apos;t turned on yet.</Centered>;

  const request = await getByManageToken(token);
  if (!request) return <Centered title="Link not found">This management link is invalid or has expired.</Centered>;

  const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-14">
      <DesignManagePanel
        token={token}
        reference={request.reference}
        teamName={request.teamName}
        status={request.status}
        vision={request.vision}
        colors={request.colors}
        contact={{ name: request.contactName, email: request.contactEmail, phone: request.contactPhone }}
        inspirationImages={request.inspirationImages ?? []}
        proofImages={request.proofImages ?? []}
        statusUrl={`${SITE}/design/status/${request.statusToken}`}
      />
    </div>
  );
}
