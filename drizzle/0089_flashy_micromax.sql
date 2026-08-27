CREATE TABLE "operational_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fingerprint" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"detail" text,
	"href" text,
	"context" jsonb,
	"occurrences" integer DEFAULT 1 NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "operational_events_fingerprint_idx" ON "operational_events" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "operational_events_unresolved_idx" ON "operational_events" USING btree ("resolved_at","last_seen_at");