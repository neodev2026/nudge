CREATE TYPE "public"."nv2_feedback_category" AS ENUM('error', 'content', 'suggestion', 'other');--> statement-breakpoint
CREATE TABLE "nv2_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" text,
	"page_url" text NOT NULL,
	"category" "nv2_feedback_category" NOT NULL,
	"content" text NOT NULL,
	"is_resolved" boolean DEFAULT false NOT NULL,
	"admin_note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nv2_feedback" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "nv2_feedback_category_idx" ON "nv2_feedback" USING btree ("category");--> statement-breakpoint
CREATE INDEX "nv2_feedback_resolved_idx" ON "nv2_feedback" USING btree ("is_resolved");--> statement-breakpoint
CREATE INDEX "nv2_feedback_created_at_idx" ON "nv2_feedback" USING btree ("created_at");--> statement-breakpoint
CREATE POLICY "nv2_feedback_insert_public" ON "nv2_feedback" AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "nv2_feedback_service_all" ON "nv2_feedback" AS PERMISSIVE FOR ALL TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "nv2_feedback_admin_all" ON "nv2_feedback" AS PERMISSIVE FOR ALL TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);