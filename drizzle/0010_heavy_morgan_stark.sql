ALTER TABLE "teams" ADD COLUMN "store_token" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "approved_design_url" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "design_request_id" uuid;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "store_items" jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX "teams_store_token_idx" ON "teams" USING btree ("store_token");--> statement-breakpoint
CREATE INDEX "teams_design_request_idx" ON "teams" USING btree ("design_request_id");