CREATE TABLE "ai_daily_counters" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"day" text NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"operation" text NOT NULL,
	"quality" text,
	"status" text DEFAULT 'success' NOT NULL,
	"estimated_cost_micros" integer,
	"input_tokens" integer,
	"output_tokens" integer,
	"total_tokens" integer,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ai_daily_counters_scope_day_idx" ON "ai_daily_counters" USING btree ("scope","day");--> statement-breakpoint
CREATE INDEX "ai_usage_events_created_idx" ON "ai_usage_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_events_provider_idx" ON "ai_usage_events" USING btree ("provider","model","created_at");