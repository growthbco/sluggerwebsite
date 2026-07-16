ALTER TABLE "design_requests" ADD COLUMN "product_types" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "design_requests" ADD COLUMN "jersey_style" text;