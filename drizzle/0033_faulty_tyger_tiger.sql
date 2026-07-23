CREATE TABLE "custom_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"lines" jsonb NOT NULL,
	"notes" text,
	"tax_exempt" boolean DEFAULT false NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer NOT NULL,
	"pay_url" text,
	"status" text DEFAULT 'sent' NOT NULL,
	"paid_at" timestamp with time zone,
	"payment_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
