ALTER TABLE "team_orders" ADD COLUMN "inbound_carrier" text;--> statement-breakpoint
ALTER TABLE "team_orders" ADD COLUMN "inbound_tracking_number" text;--> statement-breakpoint
ALTER TABLE "team_orders" ADD COLUMN "inbound_tracking_added_at" timestamp with time zone;