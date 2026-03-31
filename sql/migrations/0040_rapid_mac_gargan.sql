CREATE TYPE "public"."nv2_link_access_type" AS ENUM('public', 'members_only');--> statement-breakpoint
CREATE TABLE "nv2_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sns_type" text NOT NULL,
	"sns_id" text NOT NULL,
	"product_id" uuid NOT NULL,
	"link_access" "nv2_link_access_type" DEFAULT 'public' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"started_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nv2_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DELETE FROM "nv2_sessions";--> statement-breakpoint
ALTER TABLE "nv2_sessions" DROP CONSTRAINT "nv2_sessions_pkey";--> statement-breakpoint
ALTER TABLE "nv2_sessions" DROP COLUMN "session_id";--> statement-breakpoint
ALTER TABLE "nv2_sessions" ADD COLUMN "session_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "nv2_subscriptions" ADD CONSTRAINT "nv2_subscriptions_product_id_nv2_learning_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."nv2_learning_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "nv2_subscriptions_user_product_idx" ON "nv2_subscriptions" USING btree ("sns_type","sns_id","product_id");--> statement-breakpoint
CREATE INDEX "nv2_subscriptions_product_idx" ON "nv2_subscriptions" USING btree ("product_id");--> statement-breakpoint
CREATE POLICY "nv2_subscriptions_select_own" ON "nv2_subscriptions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (SELECT 1 FROM nv2_profiles p WHERE p.sns_type::text = "nv2_subscriptions"."sns_type"::text AND p.sns_id = "nv2_subscriptions"."sns_id" AND p.auth_user_id = auth.uid()::text));--> statement-breakpoint
CREATE POLICY "nv2_subscriptions_insert_own" ON "nv2_subscriptions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (EXISTS (SELECT 1 FROM nv2_profiles p WHERE p.sns_type::text = "nv2_subscriptions"."sns_type"::text AND p.sns_id = "nv2_subscriptions"."sns_id" AND p.auth_user_id = auth.uid()::text));--> statement-breakpoint
CREATE POLICY "nv2_subscriptions_update_own" ON "nv2_subscriptions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (EXISTS (SELECT 1 FROM nv2_profiles p WHERE p.sns_type::text = "nv2_subscriptions"."sns_type"::text AND p.sns_id = "nv2_subscriptions"."sns_id" AND p.auth_user_id = auth.uid()::text));--> statement-breakpoint
CREATE POLICY "nv2_subscriptions_admin_all" ON "nv2_subscriptions" AS PERMISSIVE FOR ALL TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "nv2_subscriptions_service_all" ON "nv2_subscriptions" AS PERMISSIVE FOR ALL TO "service_role" USING (true);