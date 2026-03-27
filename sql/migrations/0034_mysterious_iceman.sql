CREATE TYPE "public"."nv2_stage_type" AS ENUM('welcome', 'learning', 'quiz_5', 'quiz_10', 'quiz_daily', 'quiz_final', 'congratulations');--> statement-breakpoint
ALTER TABLE "nv2_learning_products" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY "nv2_learning_products_select_active" ON "nv2_learning_products" CASCADE;--> statement-breakpoint
DROP POLICY "nv2_learning_products_select_admin" ON "nv2_learning_products" CASCADE;--> statement-breakpoint
DROP POLICY "nv2_learning_products_insert_admin" ON "nv2_learning_products" CASCADE;--> statement-breakpoint
DROP POLICY "nv2_learning_products_update_admin" ON "nv2_learning_products" CASCADE;--> statement-breakpoint
DROP POLICY "nv2_learning_products_delete_admin" ON "nv2_learning_products" CASCADE;--> statement-breakpoint
DROP POLICY "nv2_learning_products_service_all" ON "nv2_learning_products" CASCADE;--> statement-breakpoint
DROP TABLE "nv2_learning_products" CASCADE;--> statement-breakpoint
ALTER TABLE "nv2_stages" ADD COLUMN "stage_type" "nv2_stage_type" DEFAULT 'learning' NOT NULL;--> statement-breakpoint
CREATE INDEX "nv2_stages_type_idx" ON "nv2_stages" USING btree ("stage_type");--> statement-breakpoint
ALTER TABLE "nv2_stages" DROP COLUMN "is_welcome";--> statement-breakpoint
DROP TYPE "public"."nv2_product_category";