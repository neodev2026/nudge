DROP INDEX "nv2_profiles_auth_user_sns_type_uidx";--> statement-breakpoint
DROP INDEX "nv2_stage_progress_profile_idx";--> statement-breakpoint
DROP INDEX "nv2_schedules_profile_idx";--> statement-breakpoint
DROP INDEX "nv2_sessions_profile_idx";--> statement-breakpoint
DROP INDEX "nv2_stage_progress_user_stage_uidx";--> statement-breakpoint
DROP INDEX "nv2_sessions_active_idx";--> statement-breakpoint
DROP INDEX "nv2_subscriptions_user_product_idx";--> statement-breakpoint
ALTER TABLE "nv2_profiles" DROP CONSTRAINT "nv2_profiles_sns_type_sns_id_pk";--> statement-breakpoint
ALTER TABLE "nv2_profiles" ADD PRIMARY KEY ("auth_user_id");--> statement-breakpoint
ALTER TABLE "nv2_profiles" ALTER COLUMN "auth_user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "nv2_profiles" ADD COLUMN "discord_id" text;--> statement-breakpoint
ALTER TABLE "nv2_profiles" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "nv2_profiles" ADD COLUMN "discord_dm_unsubscribed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "nv2_profiles" ADD COLUMN "email_unsubscribed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "nv2_stage_progress" ADD COLUMN "auth_user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "nv2_schedules" ADD COLUMN "auth_user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "nv2_sessions" ADD COLUMN "auth_user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "nv2_subscriptions" ADD COLUMN "auth_user_id" text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "nv2_profiles_discord_id_uidx" ON "nv2_profiles" USING btree ("discord_id") WHERE "nv2_profiles"."discord_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "nv2_profiles_email_uidx" ON "nv2_profiles" USING btree ("email") WHERE "nv2_profiles"."email" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "nv2_profiles_active_idx" ON "nv2_profiles" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "nv2_stage_progress_user_idx" ON "nv2_stage_progress" USING btree ("auth_user_id");--> statement-breakpoint
CREATE INDEX "nv2_schedules_user_idx" ON "nv2_schedules" USING btree ("auth_user_id");--> statement-breakpoint
CREATE INDEX "nv2_sessions_user_idx" ON "nv2_sessions" USING btree ("auth_user_id");--> statement-breakpoint
CREATE INDEX "nv2_stage_progress_user_stage_uidx" ON "nv2_stage_progress" USING btree ("auth_user_id","stage_id");--> statement-breakpoint
CREATE INDEX "nv2_sessions_active_idx" ON "nv2_sessions" USING btree ("auth_user_id","status") WHERE "nv2_sessions"."status" != 'completed';--> statement-breakpoint
CREATE INDEX "nv2_subscriptions_user_product_idx" ON "nv2_subscriptions" USING btree ("auth_user_id","product_id");--> statement-breakpoint
ALTER TABLE "nv2_profiles" DROP COLUMN "sns_type";--> statement-breakpoint
ALTER TABLE "nv2_profiles" DROP COLUMN "sns_id";--> statement-breakpoint
ALTER TABLE "nv2_stage_progress" DROP COLUMN "sns_type";--> statement-breakpoint
ALTER TABLE "nv2_stage_progress" DROP COLUMN "sns_id";--> statement-breakpoint
ALTER TABLE "nv2_schedules" DROP COLUMN "sns_type";--> statement-breakpoint
ALTER TABLE "nv2_schedules" DROP COLUMN "sns_id";--> statement-breakpoint
ALTER TABLE "nv2_sessions" DROP COLUMN "sns_type";--> statement-breakpoint
ALTER TABLE "nv2_sessions" DROP COLUMN "sns_id";--> statement-breakpoint
ALTER TABLE "nv2_subscriptions" DROP COLUMN "sns_type";--> statement-breakpoint
ALTER TABLE "nv2_subscriptions" DROP COLUMN "sns_id";--> statement-breakpoint
ALTER POLICY "nv2_stage_progress_insert_own" ON "nv2_stage_progress" TO authenticated WITH CHECK ("nv2_stage_progress"."auth_user_id" = auth.uid()::text);--> statement-breakpoint
ALTER POLICY "nv2_stage_progress_update_own" ON "nv2_stage_progress" TO authenticated USING ("nv2_stage_progress"."auth_user_id" = auth.uid()::text);--> statement-breakpoint
ALTER POLICY "nv2_schedules_select_own" ON "nv2_schedules" TO authenticated USING ("nv2_schedules"."auth_user_id" = auth.uid()::text);--> statement-breakpoint
ALTER POLICY "nv2_sessions_select_own" ON "nv2_sessions" TO authenticated USING ("nv2_sessions"."auth_user_id" = auth.uid()::text);--> statement-breakpoint
ALTER POLICY "nv2_sessions_insert_own" ON "nv2_sessions" TO authenticated WITH CHECK ("nv2_sessions"."auth_user_id" = auth.uid()::text);--> statement-breakpoint
ALTER POLICY "nv2_sessions_update_own" ON "nv2_sessions" TO authenticated USING ("nv2_sessions"."auth_user_id" = auth.uid()::text);--> statement-breakpoint
ALTER POLICY "nv2_subscriptions_select_own" ON "nv2_subscriptions" TO authenticated USING ("nv2_subscriptions"."auth_user_id" = auth.uid()::text);--> statement-breakpoint
ALTER POLICY "nv2_subscriptions_insert_own" ON "nv2_subscriptions" TO authenticated WITH CHECK ("nv2_subscriptions"."auth_user_id" = auth.uid()::text);--> statement-breakpoint
ALTER POLICY "nv2_subscriptions_update_own" ON "nv2_subscriptions" TO authenticated USING ("nv2_subscriptions"."auth_user_id" = auth.uid()::text);--> statement-breakpoint
DROP TYPE "public"."nv2_sns_type";