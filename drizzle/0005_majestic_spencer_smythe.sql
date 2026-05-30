ALTER TABLE "design_requests" ADD COLUMN "revisions_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "design_requests" ADD COLUMN "change_requests" jsonb DEFAULT '[]'::jsonb;