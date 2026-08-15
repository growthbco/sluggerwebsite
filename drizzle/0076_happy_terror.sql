CREATE TYPE "public"."designer_invoice_status" AS ENUM('submitted', 'paid', 'void');--> statement-breakpoint
CREATE TABLE "designer_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"status" "designer_invoice_status" DEFAULT 'submitted' NOT NULL,
	"designer_name" text,
	"lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"duty_cents" integer DEFAULT 0 NOT NULL,
	"previous_balance_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	"paid_by" text,
	"payment_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "designer_invoices_reference_idx" ON "designer_invoices" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "designer_invoices_status_idx" ON "designer_invoices" USING btree ("status");