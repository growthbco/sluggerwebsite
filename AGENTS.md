<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Manual team orders

When Gary asks you to enter a team order that came through text, phone, email,
or another path outside the normal website workflow, do not create the order
until he provides all of the following:

1. Production start date.
2. Service level: Standard (3 weeks), Rush (2 weeks, $100), or Priority (1 week).
3. Customer's requested in-hand date.
4. Whether Gary promised a date; if yes, the exact promised date.
5. For Priority, the manually approved premium price.

Use the validated manual-order entry path (`/admin/team-order/new` or
`/api/admin/team-order/manual`). Never bypass it by calling the generic team
order creator or inserting directly into `team_orders`.

## Team roster corrections

Customer roster edits are locked as soon as a deposit or full payment is
recorded. Do not bypass that lock through a customer manage-token endpoint.

When Gary asks for several roster corrections at once, use the consolidated
staff path (`/api/admin/team-order/roster-bulk`) or the shared
`updateRosterRowsBulkAndNotify` helper. Never loop the customer roster PATCH
endpoint: bulk corrections must reset print-file QA and produce one summarized
Discord message listing every affected player, design, old value, and new
value—not one `@here` alert per row.
