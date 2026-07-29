ALTER TABLE "design_requests" ADD COLUMN "ai_design_state" jsonb;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "archived_at" timestamp with time zone;