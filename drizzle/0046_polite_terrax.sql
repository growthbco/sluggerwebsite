ALTER TABLE "team_order_addons" ADD COLUMN "print_file_urls" jsonb;--> statement-breakpoint
ALTER TABLE "team_orders" ADD COLUMN "original_print_file_urls" jsonb;