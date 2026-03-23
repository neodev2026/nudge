CREATE TYPE "public"."nv2_sns_type" AS ENUM('discord', 'kakao', 'telegram', 'email');--> statement-breakpoint
CREATE TYPE "public"."nv2_review_status" AS ENUM('none', 'r1_pending', 'r2_pending', 'r3_pending', 'r4_pending', 'mastered');--> statement-breakpoint
CREATE TYPE "public"."nv2_quiz_type" AS ENUM('quiz_5', 'quiz_10');--> statement-breakpoint
CREATE TYPE "public"."nv2_schedule_status" AS ENUM('pending', 'sent', 'failed', 'opened');--> statement-breakpoint
CREATE TYPE "public"."nv2_schedule_type" AS ENUM('new', 'review', 'quiz', 'cheer', 'welcome');--> statement-breakpoint
CREATE TYPE "public"."nv2_card_type" AS ENUM('title', 'description', 'image', 'etymology', 'example', 'option');--> statement-breakpoint
CREATE TABLE "nv2_profiles" (
	"sns_type" "nv2_sns_type" NOT NULL,
	"sns_id" text NOT NULL,
	"auth_user_id" text,
	"display_name" text,
	"avatar_url" text,
	"daily_goal_new" integer DEFAULT 5 NOT NULL,
	"daily_goal_review" integer DEFAULT 3 NOT NULL,
	"today_new_count" integer DEFAULT 0 NOT NULL,
	"today_review_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nv2_profiles_sns_type_sns_id_pk" PRIMARY KEY("sns_type","sns_id")
);
--> statement-breakpoint
ALTER TABLE "nv2_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "nv2_stage_progress" (
	"progress_id" bigserial PRIMARY KEY NOT NULL,
	"sns_type" text NOT NULL,
	"sns_id" text NOT NULL,
	"stage_id" uuid NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"review_status" "nv2_review_status" DEFAULT 'none' NOT NULL,
	"review_round" integer,
	"next_review_at" timestamp with time zone,
	"last_review_completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nv2_stage_progress" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "nv2_quiz_results" (
	"quiz_result_id" bigserial PRIMARY KEY NOT NULL,
	"sns_type" text NOT NULL,
	"sns_id" text NOT NULL,
	"quiz_type" "nv2_quiz_type" NOT NULL,
	"trigger_at_count" integer NOT NULL,
	"covered_stage_ids" uuid[] NOT NULL,
	"matched_pairs_count" integer DEFAULT 0 NOT NULL,
	"result_snapshot" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nv2_quiz_results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "nv2_schedules" (
	"schedule_id" bigserial PRIMARY KEY NOT NULL,
	"sns_type" text NOT NULL,
	"sns_id" text NOT NULL,
	"schedule_type" "nv2_schedule_type" NOT NULL,
	"stage_id" uuid,
	"review_round" integer,
	"delivery_url" text NOT NULL,
	"message_body" text,
	"scheduled_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"opened_at" timestamp with time zone,
	"status" "nv2_schedule_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"parent_schedule_id" bigint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nv2_schedules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "nv2_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage_id" uuid NOT NULL,
	"card_type" "nv2_card_type" NOT NULL,
	"display_order" integer NOT NULL,
	"card_data" jsonb NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nv2_cards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "nv2_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learning_product_id" uuid NOT NULL,
	"stage_number" integer NOT NULL,
	"title" text NOT NULL,
	"is_welcome" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nv2_stages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "nv2_stage_progress" ADD CONSTRAINT "nv2_stage_progress_stage_id_nv2_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."nv2_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nv2_schedules" ADD CONSTRAINT "nv2_schedules_stage_id_nv2_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."nv2_stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nv2_schedules" ADD CONSTRAINT "nv2_schedules_parent_schedule_id_nv2_schedules_schedule_id_fk" FOREIGN KEY ("parent_schedule_id") REFERENCES "public"."nv2_schedules"("schedule_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nv2_cards" ADD CONSTRAINT "nv2_cards_stage_id_nv2_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."nv2_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "nv2_profiles_auth_user_sns_type_uidx" ON "nv2_profiles" USING btree ("auth_user_id","sns_type") WHERE "nv2_profiles"."auth_user_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "nv2_stage_progress_profile_idx" ON "nv2_stage_progress" USING btree ("sns_type","sns_id");--> statement-breakpoint
CREATE INDEX "nv2_stage_progress_stage_idx" ON "nv2_stage_progress" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "nv2_stage_progress_review_idx" ON "nv2_stage_progress" USING btree ("next_review_at") WHERE "nv2_stage_progress"."next_review_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "nv2_stage_progress_user_stage_uidx" ON "nv2_stage_progress" USING btree ("sns_type","sns_id","stage_id");--> statement-breakpoint
CREATE INDEX "nv2_quiz_results_profile_idx" ON "nv2_quiz_results" USING btree ("sns_type","sns_id");--> statement-breakpoint
CREATE INDEX "nv2_quiz_results_type_idx" ON "nv2_quiz_results" USING btree ("quiz_type");--> statement-breakpoint
CREATE INDEX "nv2_quiz_results_trigger_idx" ON "nv2_quiz_results" USING btree ("sns_type","sns_id","trigger_at_count");--> statement-breakpoint
CREATE INDEX "nv2_schedules_pending_idx" ON "nv2_schedules" USING btree ("scheduled_at","status") WHERE "nv2_schedules"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "nv2_schedules_profile_idx" ON "nv2_schedules" USING btree ("sns_type","sns_id");--> statement-breakpoint
CREATE INDEX "nv2_schedules_stage_idx" ON "nv2_schedules" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "nv2_schedules_type_idx" ON "nv2_schedules" USING btree ("schedule_type");--> statement-breakpoint
CREATE INDEX "nv2_cards_stage_idx" ON "nv2_cards" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "nv2_cards_stage_order_idx" ON "nv2_cards" USING btree ("stage_id","display_order");--> statement-breakpoint
CREATE INDEX "nv2_cards_type_idx" ON "nv2_cards" USING btree ("card_type");--> statement-breakpoint
CREATE INDEX "nv2_stages_product_idx" ON "nv2_stages" USING btree ("learning_product_id");--> statement-breakpoint
CREATE INDEX "nv2_stages_product_number_idx" ON "nv2_stages" USING btree ("learning_product_id","stage_number");--> statement-breakpoint
CREATE POLICY "nv2_profiles_select_own" ON "nv2_profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("nv2_profiles"."auth_user_id" = auth.uid()::text);--> statement-breakpoint
CREATE POLICY "nv2_profiles_update_own" ON "nv2_profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("nv2_profiles"."auth_user_id" = auth.uid()::text) WITH CHECK ("nv2_profiles"."auth_user_id" = auth.uid()::text);--> statement-breakpoint
CREATE POLICY "nv2_profiles_admin_all" ON "nv2_profiles" AS PERMISSIVE FOR ALL TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "nv2_profiles_service_all" ON "nv2_profiles" AS PERMISSIVE FOR ALL TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "nv2_stage_progress_select_own" ON "nv2_stage_progress" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
        EXISTS (
          SELECT 1 FROM nv2_profiles p
          WHERE p.sns_type::text = "nv2_stage_progress"."sns_type"::text
            AND p.sns_id         = "nv2_stage_progress"."sns_id"
            AND p.auth_user_id   = auth.uid()::text
        )
      );--> statement-breakpoint
CREATE POLICY "nv2_stage_progress_insert_own" ON "nv2_stage_progress" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
        EXISTS (
          SELECT 1 FROM nv2_profiles p
          WHERE p.sns_type::text = "nv2_stage_progress"."sns_type"::text
            AND p.sns_id         = "nv2_stage_progress"."sns_id"
            AND p.auth_user_id   = auth.uid()::text
        )
      );--> statement-breakpoint
CREATE POLICY "nv2_stage_progress_update_own" ON "nv2_stage_progress" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
        EXISTS (
          SELECT 1 FROM nv2_profiles p
          WHERE p.sns_type::text = "nv2_stage_progress"."sns_type"::text
            AND p.sns_id         = "nv2_stage_progress"."sns_id"
            AND p.auth_user_id   = auth.uid()::text
        )
      );--> statement-breakpoint
CREATE POLICY "nv2_stage_progress_admin_all" ON "nv2_stage_progress" AS PERMISSIVE FOR ALL TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "nv2_stage_progress_service_all" ON "nv2_stage_progress" AS PERMISSIVE FOR ALL TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "nv2_quiz_results_select_own" ON "nv2_quiz_results" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
        EXISTS (
          SELECT 1 FROM nv2_profiles p
          WHERE p.sns_type::text = "nv2_quiz_results"."sns_type"::text
            AND p.sns_id         = "nv2_quiz_results"."sns_id"
            AND p.auth_user_id   = auth.uid()::text
        )
      );--> statement-breakpoint
CREATE POLICY "nv2_quiz_results_insert_own" ON "nv2_quiz_results" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
        EXISTS (
          SELECT 1 FROM nv2_profiles p
          WHERE p.sns_type::text = "nv2_quiz_results"."sns_type"::text
            AND p.sns_id         = "nv2_quiz_results"."sns_id"
            AND p.auth_user_id   = auth.uid()::text
        )
      );--> statement-breakpoint
CREATE POLICY "nv2_quiz_results_admin_all" ON "nv2_quiz_results" AS PERMISSIVE FOR ALL TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "nv2_quiz_results_service_all" ON "nv2_quiz_results" AS PERMISSIVE FOR ALL TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "nv2_schedules_select_own" ON "nv2_schedules" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
        EXISTS (
          SELECT 1 FROM nv2_profiles p
          WHERE p.sns_type::text = "nv2_schedules"."sns_type"::text
            AND p.sns_id         = "nv2_schedules"."sns_id"
            AND p.auth_user_id   = auth.uid()::text
        )
      );--> statement-breakpoint
CREATE POLICY "nv2_schedules_admin_all" ON "nv2_schedules" AS PERMISSIVE FOR ALL TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "nv2_schedules_service_all" ON "nv2_schedules" AS PERMISSIVE FOR ALL TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "nv2_cards_select_active" ON "nv2_cards" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("nv2_cards"."is_active" = true);--> statement-breakpoint
CREATE POLICY "nv2_cards_admin_all" ON "nv2_cards" AS PERMISSIVE FOR ALL TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "nv2_cards_service_all" ON "nv2_cards" AS PERMISSIVE FOR ALL TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "nv2_stages_select_active" ON "nv2_stages" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("nv2_stages"."is_active" = true);--> statement-breakpoint
CREATE POLICY "nv2_stages_admin_all" ON "nv2_stages" AS PERMISSIVE FOR ALL TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "nv2_stages_service_all" ON "nv2_stages" AS PERMISSIVE FOR ALL TO "service_role" USING (true);