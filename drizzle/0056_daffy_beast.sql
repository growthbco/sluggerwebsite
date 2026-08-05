ALTER TABLE "custom_invoices" ADD COLUMN "shipping_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "weight_oz" integer DEFAULT 16 NOT NULL;