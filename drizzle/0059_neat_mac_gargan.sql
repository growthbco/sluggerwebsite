CREATE TABLE "sms_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"direction" text NOT NULL,
	"channel" text DEFAULT 'sms' NOT NULL,
	"body" text NOT NULL,
	"media_count" integer DEFAULT 0 NOT NULL,
	"staff" text,
	"twilio_sid" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sms_messages_phone_idx" ON "sms_messages" USING btree ("phone","created_at");