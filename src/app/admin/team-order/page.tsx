import { redirect } from "next/navigation";

// /admin/team-order without an order id isn't a page - the detail pages live
// at /admin/team-order/<id> (reached by clicking an order on the dashboard).
// Send anyone who types the bare URL back to the dashboard instead of a 404.
export default function AdminTeamOrderIndex() {
  redirect("/admin");
}
