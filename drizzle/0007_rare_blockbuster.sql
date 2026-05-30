ALTER TABLE "team_orders" ADD COLUMN "print_file_url" text;--> statement-breakpoint
ALTER TABLE "team_orders" ADD COLUMN "print_file_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "team_orders" ADD COLUMN "print_file_verification" jsonb;