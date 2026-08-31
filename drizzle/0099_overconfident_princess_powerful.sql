ALTER TABLE "sms_contacts" ADD COLUMN "follow_up_status" text;--> statement-breakpoint
ALTER TABLE "sms_contacts" ADD COLUMN "next_follow_up_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sms_contacts" ADD COLUMN "follow_up_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sms_contacts" ADD COLUMN "follow_up_updated_by" text;--> statement-breakpoint
ALTER TABLE "sms_contacts" ADD COLUMN "do_not_call_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "sms_contacts_follow_up_idx" ON "sms_contacts" USING btree ("follow_up_status","next_follow_up_at");