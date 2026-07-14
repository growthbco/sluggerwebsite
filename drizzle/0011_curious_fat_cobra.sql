ALTER TABLE "design_requests" ADD COLUMN "follow_ups_sent" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "design_requests" ADD COLUMN "last_follow_up_at" timestamp with time zone;