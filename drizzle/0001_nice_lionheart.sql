ALTER TABLE "team_orders" ADD COLUMN "manage_token" text;--> statement-breakpoint
CREATE UNIQUE INDEX "team_orders_manage_token_idx" ON "team_orders" USING btree ("manage_token");