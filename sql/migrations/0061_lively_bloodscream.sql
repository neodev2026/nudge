CREATE TABLE "nv2_marathon_seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"timezone" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "starts_before_ends" CHECK ("nv2_marathon_seasons"."starts_at" < "nv2_marathon_seasons"."ends_at")
);
--> statement-breakpoint
CREATE INDEX "nv2_marathon_seasons_starts_at_idx" ON "nv2_marathon_seasons" USING btree ("starts_at");