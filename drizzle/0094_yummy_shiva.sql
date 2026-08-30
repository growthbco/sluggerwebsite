ALTER TABLE "team_orders" ADD COLUMN "manual_entry_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "team_orders" ADD COLUMN "timeline_start_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "team_orders" ADD COLUMN "turnaround_tier" text;--> statement-breakpoint
ALTER TABLE "team_orders" ADD COLUMN "requested_in_hand_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "team_orders" ADD COLUMN "customer_date_promised" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "team_orders" ADD COLUMN "promised_in_hand_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "team_orders" ADD COLUMN "priority_fee_cents" integer DEFAULT 0 NOT NULL;