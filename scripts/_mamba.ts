import { config } from "dotenv";
config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
async function main() {
  const cols = await sql`select column_name from information_schema.columns where table_name = 'order_items'`;
  console.log("COLS:", cols.map((c: any) => c.column_name).join(", "));
  const ords = await sql`select id, reference, status, total_cents, customer_name, created_at from orders where team_id = '20e27ac9-e19b-4d3e-a567-9e79a029adb4' order by created_at`;
  for (const o of ords) {
    const items = await sql`select * from order_items where order_id = ${o.id}`;
    console.log(`${o.reference} [${o.status}] ${o.customer_name} $${o.total_cents/100} ${o.created_at}:`);
    for (const it of items) console.log("  ", JSON.stringify(it));
  }
}
main();
