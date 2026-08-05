CREATE TABLE "design_lab_renders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visitor_id" uuid,
	"url" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "design_lab_renders" ADD CONSTRAINT "design_lab_renders_visitor_id_design_lab_visitors_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."design_lab_visitors"("id") ON DELETE no action ON UPDATE no action;