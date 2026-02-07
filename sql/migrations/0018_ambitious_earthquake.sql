DROP INDEX "user_subscription_active_idx";--> statement-breakpoint
DROP INDEX "user_subscription_tier_idx";--> statement-breakpoint
DROP INDEX "user_subscription_last_sent_idx";--> statement-breakpoint
DROP INDEX "user_subscription_push_enabled_idx";--> statement-breakpoint
ALTER TABLE "user_sns_connection" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX "user_sub_worker_batch_idx" ON "user_product_subscription" USING btree ("is_active","push_enabled","last_card_sent_at");--> statement-breakpoint
CREATE INDEX "user_sub_tier_check_idx" ON "user_product_subscription" USING btree ("subscription_tier","last_card_sent_at");--> statement-breakpoint
CREATE INDEX "user_sns_active_idx" ON "user_sns_connection" USING btree ("user_id","is_active");--> statement-breakpoint
DROP POLICY "user_subscription_select_admin" ON "user_product_subscription" CASCADE;--> statement-breakpoint
CREATE POLICY "user_subscription_worker_manage" ON "user_product_subscription" AS PERMISSIVE FOR ALL TO "n8n_worker" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "user_subscription_admin_all" ON "user_product_subscription" AS PERMISSIVE FOR ALL TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "user_sns_worker_select" ON "user_sns_connection" AS PERMISSIVE FOR SELECT TO "n8n_worker" USING (true);