ALTER TABLE "design_requests" ADD COLUMN "proof_review_urls" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "design_requests" ADD COLUMN "superseded_proof_urls" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "team_orders" ADD COLUMN "spec_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "team_orders" ADD COLUMN "spec_snapshot" jsonb;