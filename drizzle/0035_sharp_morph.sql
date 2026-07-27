CREATE TABLE "design_lab_visitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visitor_key" text NOT NULL,
	"email" text,
	"generations" integer DEFAULT 0 NOT NULL,
	"paid_at" timestamp with time zone,
	"stripe_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "design_lab_visitors_visitor_key_unique" UNIQUE("visitor_key")
);
