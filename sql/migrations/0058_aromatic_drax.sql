CREATE TYPE "public"."nv2_marathon_run_status" AS ENUM('in_progress', 'completed');--> statement-breakpoint
CREATE TABLE "nv2_marathon_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"stage_id" uuid NOT NULL,
	"question_direction" text NOT NULL,
	"is_correct" boolean NOT NULL,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nv2_marathon_answers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "nv2_marathon_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" text NOT NULL,
	"product_id" uuid NOT NULL,
	"run_number" integer NOT NULL,
	"status" "nv2_marathon_run_status" DEFAULT 'in_progress' NOT NULL,
	"score" integer,
	"total_questions" integer,
	"last_stage_index" integer DEFAULT 0 NOT NULL,
	"elapsed_seconds" integer,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nv2_marathon_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "nv2_marathon_answers_run_idx" ON "nv2_marathon_answers" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "nv2_marathon_answers_run_stage_uidx" ON "nv2_marathon_answers" USING btree ("run_id","stage_id");--> statement-breakpoint
CREATE INDEX "nv2_marathon_runs_user_idx" ON "nv2_marathon_runs" USING btree ("auth_user_id");--> statement-breakpoint
CREATE INDEX "nv2_marathon_runs_product_idx" ON "nv2_marathon_runs" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "nv2_marathon_runs_user_product_idx" ON "nv2_marathon_runs" USING btree ("auth_user_id","product_id");--> statement-breakpoint
CREATE INDEX "nv2_marathon_runs_status_idx" ON "nv2_marathon_runs" USING btree ("auth_user_id","status");--> statement-breakpoint
CREATE POLICY "nv2_marathon_answers_service_all" ON "nv2_marathon_answers" AS PERMISSIVE FOR ALL TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "nv2_marathon_answers_admin_all" ON "nv2_marathon_answers" AS PERMISSIVE FOR ALL TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "nv2_marathon_runs_select_own" ON "nv2_marathon_runs" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("nv2_marathon_runs"."auth_user_id" = auth.uid()::text);--> statement-breakpoint
CREATE POLICY "nv2_marathon_runs_insert_own" ON "nv2_marathon_runs" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("nv2_marathon_runs"."auth_user_id" = auth.uid()::text);--> statement-breakpoint
CREATE POLICY "nv2_marathon_runs_update_own" ON "nv2_marathon_runs" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("nv2_marathon_runs"."auth_user_id" = auth.uid()::text);--> statement-breakpoint
CREATE POLICY "nv2_marathon_runs_service_all" ON "nv2_marathon_runs" AS PERMISSIVE FOR ALL TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "nv2_marathon_runs_admin_all" ON "nv2_marathon_runs" AS PERMISSIVE FOR ALL TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);