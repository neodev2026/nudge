ALTER TABLE "nv2_profiles" ADD COLUMN "timezone" text DEFAULT 'Asia/Seoul' NOT NULL;--> statement-breakpoint
ALTER TABLE "nv2_profiles" ADD COLUMN "send_hour" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "public"."nv2_schedules" ALTER COLUMN "schedule_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."nv2_schedule_type";--> statement-breakpoint
CREATE TYPE "public"."nv2_schedule_type" AS ENUM('new', 'review', 'cheer', 'welcome');--> statement-breakpoint
ALTER TABLE "public"."nv2_schedules" ALTER COLUMN "schedule_type" SET DATA TYPE "public"."nv2_schedule_type" USING "schedule_type"::"public"."nv2_schedule_type";