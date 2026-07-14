CREATE TABLE "team_order_addons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_order_id" uuid NOT NULL,
	"rows" jsonb NOT NULL,
	"total_cents" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"stripe_checkout_session_id" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_orders" ADD COLUMN "full_invoice_url" text;--> statement-breakpoint
ALTER TABLE "team_order_addons" ADD CONSTRAINT "team_order_addons_team_order_id_team_orders_id_fk" FOREIGN KEY ("team_order_id") REFERENCES "public"."team_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "team_order_addons_order_idx" ON "team_order_addons" USING btree ("team_order_id");