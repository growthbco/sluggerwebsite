ALTER TABLE "orders" ADD COLUMN "shipping_protection_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_protection_value_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_protection_covered_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "team_orders" ADD COLUMN "shipping_protection_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "team_orders" ADD COLUMN "shipping_protection_value_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "team_orders" ADD COLUMN "shipping_protection_covered_cents" integer DEFAULT 0 NOT NULL;