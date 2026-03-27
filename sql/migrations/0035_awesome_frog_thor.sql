CREATE TYPE "public"."nv2_product_category" AS ENUM('language', 'medical', 'exam', 'business', 'general');--> statement-breakpoint
CREATE TABLE "nv2_learning_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "nv2_product_category" DEFAULT 'general' NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"slug" text NOT NULL,
	"icon" text,
	"meta" jsonb DEFAULT '{}'::jsonb,
	"total_stages" integer DEFAULT 0 NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nv2_learning_products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "nv2_learning_products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "nv2_learning_products_active_order_idx" ON "nv2_learning_products" USING btree ("is_active","display_order");--> statement-breakpoint
CREATE INDEX "nv2_learning_products_category_idx" ON "nv2_learning_products" USING btree ("category");--> statement-breakpoint
CREATE INDEX "nv2_learning_products_slug_idx" ON "nv2_learning_products" USING btree ("slug");--> statement-breakpoint
CREATE POLICY "nv2_learning_products_select_active" ON "nv2_learning_products" AS PERMISSIVE FOR SELECT TO public USING ("nv2_learning_products"."is_active" = true);--> statement-breakpoint
CREATE POLICY "nv2_learning_products_select_admin" ON "nv2_learning_products" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "nv2_learning_products_insert_admin" ON "nv2_learning_products" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "nv2_learning_products_update_admin" ON "nv2_learning_products" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "nv2_learning_products_delete_admin" ON "nv2_learning_products" AS PERMISSIVE FOR DELETE TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "nv2_learning_products_service_all" ON "nv2_learning_products" AS PERMISSIVE FOR ALL TO "service_role" USING (true);