CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"phone" text,
	"password_hash" text,
	"referral_code" text NOT NULL,
	"referred_by_code" text,
	"referral_credit_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "customers_email_idx" ON "customers" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_referral_code_idx" ON "customers" USING btree ("referral_code");--> statement-breakpoint
CREATE INDEX "customers_referred_by_idx" ON "customers" USING btree ("referred_by_code");