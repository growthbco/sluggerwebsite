ALTER TABLE "orders" ADD COLUMN "tracking_number" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipped_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "team_orders" ADD COLUMN "deposit_cents" integer;--> statement-breakpoint
ALTER TABLE "team_orders" ADD COLUMN "deposit_paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "team_orders" ADD COLUMN "balance_invoice_url" text;--> statement-breakpoint
ALTER TABLE "team_orders" ADD COLUMN "invoice_reminders_sent" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "team_orders" ADD COLUMN "last_invoice_reminder_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "team_orders" ADD COLUMN "tracking_number" text;--> statement-breakpoint
ALTER TABLE "team_orders" ADD COLUMN "shipped_at" timestamp with time zone;