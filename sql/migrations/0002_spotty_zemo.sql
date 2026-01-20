CREATE TABLE "admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "admins" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "learning_product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "learning_product_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "learning_product" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "learning_product_active_display_idx" ON "learning_product" USING btree ("is_active","display_order");--> statement-breakpoint
CREATE POLICY "admins_select_all" ON "admins" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "admins_insert_admin" ON "admins" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
        EXISTS (
          SELECT 1 FROM admins
          WHERE email = (auth.jwt()->>'email')::text
        )
      );--> statement-breakpoint
CREATE POLICY "admins_delete_admin" ON "admins" AS PERMISSIVE FOR DELETE TO "authenticated" USING (
        EXISTS (
          SELECT 1 FROM admins
          WHERE email = (auth.jwt()->>'email')::text
        )
      );--> statement-breakpoint
CREATE POLICY "learning_product_select_active" ON "learning_product" AS PERMISSIVE FOR SELECT TO public USING ("learning_product"."is_active" = true);--> statement-breakpoint
CREATE POLICY "learning_product_select_admin" ON "learning_product" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "learning_product_insert_admin" ON "learning_product" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "learning_product_update_admin" ON "learning_product" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
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
CREATE POLICY "learning_product_delete_admin" ON "learning_product" AS PERMISSIVE FOR DELETE TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);