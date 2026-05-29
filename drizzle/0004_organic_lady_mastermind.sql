ALTER TABLE "design_requests" ADD COLUMN "needed_by" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "design_requests" ADD COLUMN "rush" boolean DEFAULT false NOT NULL;