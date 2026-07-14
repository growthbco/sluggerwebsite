ALTER TABLE "design_requests" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "design_requests" ADD COLUMN "archived_note" text;