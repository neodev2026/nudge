CREATE TYPE "public"."hyper_sync_result" AS ENUM('known', 'unknown');--> statement-breakpoint
ALTER TYPE "public"."nv2_schedule_type" ADD VALUE 'hyper_sync_review';--> statement-breakpoint
CREATE TABLE "nv2_hyper_sync_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" text NOT NULL,
	"product_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"result" "hyper_sync_result" NOT NULL,
	"known_count" integer DEFAULT 0 NOT NULL,
	"session_date" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nv2_hyper_sync_results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "nv2_hyper_sync_results_user_card_date_uidx" ON "nv2_hyper_sync_results" USING btree ("auth_user_id","card_id","session_date");--> statement-breakpoint
CREATE INDEX "nv2_hyper_sync_results_user_idx" ON "nv2_hyper_sync_results" USING btree ("auth_user_id");--> statement-breakpoint
CREATE INDEX "nv2_hyper_sync_results_session_idx" ON "nv2_hyper_sync_results" USING btree ("session_id");--> statement-breakpoint
CREATE POLICY "nv2_hyper_sync_results_select_own" ON "nv2_hyper_sync_results" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("nv2_hyper_sync_results"."auth_user_id" = auth.uid()::text);--> statement-breakpoint
CREATE POLICY "nv2_hyper_sync_results_service_all" ON "nv2_hyper_sync_results" AS PERMISSIVE FOR ALL TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "nv2_hyper_sync_results_admin_all" ON "nv2_hyper_sync_results" AS PERMISSIVE FOR ALL TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);