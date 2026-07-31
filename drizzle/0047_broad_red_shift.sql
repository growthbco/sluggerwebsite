ALTER TABLE "orders" ADD COLUMN "customer_note" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "fundraise_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "fundraise_percent" integer DEFAULT 0 NOT NULL;