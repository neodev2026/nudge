CREATE TYPE "public"."card_type" AS ENUM('meaning_pronunciation', 'image', 'example_sentence', 'etymology', 'synonym_antonym');--> statement-breakpoint
CREATE TABLE "learning_card" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learning_content_id" uuid NOT NULL,
	"card_type" "card_type" NOT NULL,
	"card_data" jsonb NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "learning_card" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "learning_card" ADD CONSTRAINT "learning_card_learning_content_id_learning_content_id_fk" FOREIGN KEY ("learning_content_id") REFERENCES "public"."learning_content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "learning_card_content_idx" ON "learning_card" USING btree ("learning_content_id");--> statement-breakpoint
CREATE INDEX "learning_card_content_order_idx" ON "learning_card" USING btree ("learning_content_id","display_order");--> statement-breakpoint
CREATE INDEX "learning_card_active_idx" ON "learning_card" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "learning_card_type_idx" ON "learning_card" USING btree ("card_type");--> statement-breakpoint
CREATE POLICY "learning_card_select_active" ON "learning_card" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
        "learning_card"."is_active" = true
        AND EXISTS (
          SELECT 1 FROM "learning_content"
          WHERE "learning_content"."id" = "learning_card"."learning_content_id"
          AND "learning_content"."is_active" = true
          AND EXISTS (
            SELECT 1 FROM "learning_product"
            WHERE "learning_product"."id" = "learning_content"."learning_product_id"
            AND "learning_product"."is_active" = true
          )
        )
      );--> statement-breakpoint
CREATE POLICY "learning_card_select_admin" ON "learning_card" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "learning_card_insert_admin" ON "learning_card" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "learning_card_update_admin" ON "learning_card" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
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
CREATE POLICY "learning_card_delete_admin" ON "learning_card" AS PERMISSIVE FOR DELETE TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);