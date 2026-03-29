CREATE TYPE "public"."nv2_session_kind" AS ENUM('new', 'review');--> statement-breakpoint
ALTER TABLE "nv2_sessions" ADD COLUMN "session_kind" "nv2_session_kind" DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE "nv2_sessions" ADD COLUMN "review_round" integer;