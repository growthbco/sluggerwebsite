ALTER TABLE "designer_invoices" ADD COLUMN "vendor_ref" text;--> statement-breakpoint
ALTER TABLE "designer_invoices" ADD COLUMN "attachment_urls" jsonb DEFAULT '[]'::jsonb NOT NULL;