CREATE TYPE "public"."design_request_status" AS ENUM('submitted', 'in_design', 'proof_sent', 'changes_requested', 'approved', 'ordered', 'cancelled');--> statement-breakpoint
CREATE TABLE "design_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"status" "design_request_status" DEFAULT 'submitted' NOT NULL,
	"team_name" text NOT NULL,
	"sport" text,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" text,
	"vision" text,
	"colors" text,
	"notes" text,
	"inspiration_images" jsonb DEFAULT '[]'::jsonb,
	"proof_images" jsonb DEFAULT '[]'::jsonb,
	"approved_design_url" text,
	"status_token" text,
	"manage_token" text,
	"proof_sent_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"ordered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_orders" ADD COLUMN "design_request_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "design_requests_reference_idx" ON "design_requests" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "design_requests_status_token_idx" ON "design_requests" USING btree ("status_token");--> statement-breakpoint
CREATE UNIQUE INDEX "design_requests_manage_token_idx" ON "design_requests" USING btree ("manage_token");--> statement-breakpoint
CREATE INDEX "design_requests_status_idx" ON "design_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "team_orders_design_request_idx" ON "team_orders" USING btree ("design_request_id");