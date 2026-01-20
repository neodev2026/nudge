CREATE TYPE "public"."content_type" AS ENUM('word', 'sentence', 'formula');--> statement-breakpoint
CREATE TABLE "learning_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learning_product_id" uuid NOT NULL,
	"content_type" "content_type" NOT NULL,
	"content_name" text NOT NULL,
	"description" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "learning_content" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "learning_content" ADD CONSTRAINT "learning_content_learning_product_id_learning_product_id_fk" FOREIGN KEY ("learning_product_id") REFERENCES "public"."learning_product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "learning_content_product_idx" ON "learning_content" USING btree ("learning_product_id");--> statement-breakpoint
CREATE INDEX "learning_content_product_order_idx" ON "learning_content" USING btree ("learning_product_id","display_order");--> statement-breakpoint
CREATE INDEX "learning_content_active_idx" ON "learning_content" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "learning_content_type_idx" ON "learning_content" USING btree ("content_type");--> statement-breakpoint
CREATE POLICY "learning_content_select_active" ON "learning_content" AS PERMISSIVE FOR SELECT TO public USING (
        "learning_content"."is_active" = true
        AND EXISTS (
          SELECT 1 FROM "learning_product"
          WHERE "learning_product"."id" = "learning_content"."learning_product_id"
          AND "learning_product"."is_active" = true
        )
      );--> statement-breakpoint
CREATE POLICY "learning_content_select_admin" ON "learning_content" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "learning_content_insert_admin" ON "learning_content" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "learning_content_update_admin" ON "learning_content" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
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
CREATE POLICY "learning_content_delete_admin" ON "learning_content" AS PERMISSIVE FOR DELETE TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);