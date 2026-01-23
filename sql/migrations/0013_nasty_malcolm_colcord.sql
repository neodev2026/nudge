CREATE TYPE "public"."card_scope" AS ENUM('shared', 'personalized');--> statement-breakpoint
CREATE TYPE "public"."subscription_tier" AS ENUM('basic', 'premium', 'vip');--> statement-breakpoint
DROP INDEX "learning_card_content_order_idx";--> statement-breakpoint
DROP INDEX "learning_card_active_idx";--> statement-breakpoint
ALTER TABLE "learning_card" ADD COLUMN "card_scope" "card_scope" DEFAULT 'shared' NOT NULL;--> statement-breakpoint
ALTER TABLE "learning_card" ADD COLUMN "personalization_context" jsonb;--> statement-breakpoint
ALTER TABLE "user_product_subscription" ADD COLUMN "subscription_tier" "subscription_tier" DEFAULT 'basic' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_product_subscription" ADD COLUMN "last_card_sent_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "learning_card_scope_idx" ON "learning_card" USING btree ("card_scope");--> statement-breakpoint
CREATE INDEX "learning_card_user_context_idx" ON "learning_card" USING btree (("personalization_context"->>'userId'));--> statement-breakpoint
CREATE INDEX "user_subscription_tier_idx" ON "user_product_subscription" USING btree ("subscription_tier");--> statement-breakpoint
CREATE INDEX "user_subscription_last_sent_idx" ON "user_product_subscription" USING btree ("last_card_sent_at");--> statement-breakpoint
ALTER TABLE "public"."learning_card" ALTER COLUMN "card_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."card_type";--> statement-breakpoint
CREATE TYPE "public"."card_type" AS ENUM('basic_meaning', 'pronunciation', 'etymology', 'cloze', 'contrast', 'cultural_context', 'example', 'derivatives', 'idiom', 'pos_specific');--> statement-breakpoint
ALTER TABLE "public"."learning_card" ALTER COLUMN "card_type" SET DATA TYPE "public"."card_type" USING "card_type"::"public"."card_type";--> statement-breakpoint
ALTER POLICY "learning_card_select_active" ON "learning_card" RENAME TO "learning_card_select_scoped";--> statement-breakpoint
DROP POLICY "learning_card_select_admin" ON "learning_card" CASCADE;--> statement-breakpoint
DROP POLICY "learning_card_insert_admin" ON "learning_card" CASCADE;--> statement-breakpoint
DROP POLICY "learning_card_update_admin" ON "learning_card" CASCADE;--> statement-breakpoint
DROP POLICY "learning_card_delete_admin" ON "learning_card" CASCADE;--> statement-breakpoint
DROP POLICY "user_subscription_insert_admin" ON "user_product_subscription" CASCADE;--> statement-breakpoint
DROP POLICY "user_subscription_update_admin" ON "user_product_subscription" CASCADE;--> statement-breakpoint
DROP POLICY "user_subscription_delete_own" ON "user_product_subscription" CASCADE;--> statement-breakpoint
DROP POLICY "user_subscription_delete_admin" ON "user_product_subscription" CASCADE;--> statement-breakpoint
CREATE POLICY "learning_card_admin_all" ON "learning_card" AS PERMISSIVE FOR ALL TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "learning_card_n8n_worker_insert" ON "learning_card" AS PERMISSIVE FOR INSERT TO "n8n_worker" WITH CHECK (true);--> statement-breakpoint
ALTER POLICY "learning_card_n8n_worker_select" ON "learning_card" TO n8n_worker USING (true);