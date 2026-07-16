ALTER TABLE "team_orders" ADD COLUMN "tax_exempt" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "tax_exempt" boolean DEFAULT false NOT NULL;