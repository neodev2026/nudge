ALTER TYPE "public"."nv2_card_type" ADD VALUE 'story';--> statement-breakpoint
ALTER TYPE "public"."nv2_stage_type" ADD VALUE 'story';--> statement-breakpoint
DROP INDEX "nv2_subscriptions_user_product_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "nv2_subscriptions_user_product_idx" ON "nv2_subscriptions" USING btree ("auth_user_id","product_id");