ALTER TABLE "team_order_roster" ADD COLUMN "sizes" jsonb;--> statement-breakpoint
ALTER TABLE "team_orders" ADD COLUMN "items" jsonb DEFAULT '["jersey"]'::jsonb;