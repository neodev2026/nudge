CREATE TYPE "public"."nv2_session_status" AS ENUM('pending', 'in_progress', 'completed');--> statement-breakpoint
CREATE TABLE "nv2_product_session_stages" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"product_session_id" uuid NOT NULL,
	"stage_id" uuid NOT NULL,
	"display_order" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nv2_product_session_stages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "nv2_product_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"session_number" integer NOT NULL,
	"title" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nv2_product_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "nv2_sessions" (
	"session_id" bigserial PRIMARY KEY NOT NULL,
	"sns_type" text NOT NULL,
	"sns_id" text NOT NULL,
	"product_session_id" uuid NOT NULL,
	"status" "nv2_session_status" DEFAULT 'pending' NOT NULL,
	"dm_sent_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nv2_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "nv2_product_session_stages" ADD CONSTRAINT "nv2_product_session_stages_product_session_id_nv2_product_sessions_id_fk" FOREIGN KEY ("product_session_id") REFERENCES "public"."nv2_product_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nv2_product_session_stages" ADD CONSTRAINT "nv2_product_session_stages_stage_id_nv2_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."nv2_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nv2_product_sessions" ADD CONSTRAINT "nv2_product_sessions_product_id_nv2_learning_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."nv2_learning_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nv2_sessions" ADD CONSTRAINT "nv2_sessions_product_session_id_nv2_product_sessions_id_fk" FOREIGN KEY ("product_session_id") REFERENCES "public"."nv2_product_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "nv2_pss_session_idx" ON "nv2_product_session_stages" USING btree ("product_session_id");--> statement-breakpoint
CREATE INDEX "nv2_pss_stage_idx" ON "nv2_product_session_stages" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "nv2_pss_session_order_idx" ON "nv2_product_session_stages" USING btree ("product_session_id","display_order");--> statement-breakpoint
CREATE INDEX "nv2_product_sessions_product_idx" ON "nv2_product_sessions" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "nv2_product_sessions_product_order_idx" ON "nv2_product_sessions" USING btree ("product_id","session_number");--> statement-breakpoint
CREATE INDEX "nv2_sessions_profile_idx" ON "nv2_sessions" USING btree ("sns_type","sns_id");--> statement-breakpoint
CREATE INDEX "nv2_sessions_product_session_idx" ON "nv2_sessions" USING btree ("product_session_id");--> statement-breakpoint
CREATE INDEX "nv2_sessions_status_idx" ON "nv2_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "nv2_sessions_active_idx" ON "nv2_sessions" USING btree ("sns_type","sns_id","status") WHERE "nv2_sessions"."status" != 'completed';--> statement-breakpoint
CREATE POLICY "nv2_product_session_stages_select_public" ON "nv2_product_session_stages" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "nv2_product_session_stages_admin_all" ON "nv2_product_session_stages" AS PERMISSIVE FOR ALL TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "nv2_product_session_stages_service_all" ON "nv2_product_session_stages" AS PERMISSIVE FOR ALL TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "nv2_product_sessions_select_active" ON "nv2_product_sessions" AS PERMISSIVE FOR SELECT TO public USING ("nv2_product_sessions"."is_active" = true);--> statement-breakpoint
CREATE POLICY "nv2_product_sessions_admin_all" ON "nv2_product_sessions" AS PERMISSIVE FOR ALL TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "nv2_product_sessions_service_all" ON "nv2_product_sessions" AS PERMISSIVE FOR ALL TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "nv2_sessions_select_own" ON "nv2_sessions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
        EXISTS (
          SELECT 1 FROM nv2_profiles p
          WHERE p.sns_type::text = "nv2_sessions"."sns_type"::text
            AND p.sns_id         = "nv2_sessions"."sns_id"
            AND p.auth_user_id   = auth.uid()::text
        )
      );--> statement-breakpoint
CREATE POLICY "nv2_sessions_insert_own" ON "nv2_sessions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
        EXISTS (
          SELECT 1 FROM nv2_profiles p
          WHERE p.sns_type::text = "nv2_sessions"."sns_type"::text
            AND p.sns_id         = "nv2_sessions"."sns_id"
            AND p.auth_user_id   = auth.uid()::text
        )
      );--> statement-breakpoint
CREATE POLICY "nv2_sessions_update_own" ON "nv2_sessions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
        EXISTS (
          SELECT 1 FROM nv2_profiles p
          WHERE p.sns_type::text = "nv2_sessions"."sns_type"::text
            AND p.sns_id         = "nv2_sessions"."sns_id"
            AND p.auth_user_id   = auth.uid()::text
        )
      );--> statement-breakpoint
CREATE POLICY "nv2_sessions_admin_all" ON "nv2_sessions" AS PERMISSIVE FOR ALL TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "nv2_sessions_service_all" ON "nv2_sessions" AS PERMISSIVE FOR ALL TO "service_role" USING (true);