CREATE TYPE "public"."nv2_stage_type" AS ENUM('welcome', 'learning', 'quiz_5', 'quiz_10', 'quiz_daily', 'quiz_final', 'congratulations');--> statement-breakpoint
ALTER TABLE "nv2_stages" ADD COLUMN "stage_type" "nv2_stage_type" DEFAULT 'learning' NOT NULL;--> statement-breakpoint
CREATE INDEX "nv2_stages_type_idx" ON "nv2_stages" USING btree ("stage_type");--> statement-breakpoint
ALTER TABLE "nv2_stages" DROP COLUMN "is_welcome";