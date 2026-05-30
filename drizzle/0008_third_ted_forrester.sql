ALTER TYPE "public"."design_request_status" ADD VALUE 'pending_payment' BEFORE 'submitted';--> statement-breakpoint
ALTER TABLE "design_requests" ADD COLUMN "design_fee_amount_cents" integer DEFAULT 3500 NOT NULL;--> statement-breakpoint
ALTER TABLE "design_requests" ADD COLUMN "design_fee_paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "design_requests" ADD COLUMN "design_fee_payment_id" text;--> statement-breakpoint
ALTER TABLE "design_requests" ADD COLUMN "design_fee_waived_reason" text;--> statement-breakpoint
ALTER TABLE "design_requests" ADD COLUMN "design_fee_waived_ref" text;