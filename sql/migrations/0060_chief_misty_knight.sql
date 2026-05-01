ALTER TYPE "public"."nv2_schedule_type" ADD VALUE 'marathon_nudge';--> statement-breakpoint
ALTER TABLE "nv2_marathon_runs" ADD COLUMN "nudge_card_cursor" integer DEFAULT 0 NOT NULL;