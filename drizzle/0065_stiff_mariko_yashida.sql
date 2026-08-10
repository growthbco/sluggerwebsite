ALTER TABLE "sms_contacts" ADD COLUMN "starred_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sms_contacts" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sms_contacts" ADD COLUMN "last_read_at" timestamp with time zone;