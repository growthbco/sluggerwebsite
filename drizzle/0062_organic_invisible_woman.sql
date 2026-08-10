ALTER TABLE "design_requests" ADD COLUMN "rush_approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "design_requests" ADD COLUMN "rush_approved_by" text;