CREATE TYPE "public"."push_channel" AS ENUM('discord', 'kakao', 'email', 'telegram');--> statement-breakpoint
ALTER TYPE "public"."sns_type" ADD VALUE 'telegram';--> statement-breakpoint
CREATE TABLE "card_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"learning_product_id" uuid NOT NULL,
	"learning_content_id" uuid NOT NULL,
	"learning_card_id" uuid NOT NULL,
	"feedback_score" integer NOT NULL,
	"card_opened_at" timestamp with time zone NOT NULL,
	"feedback_submitted_at" timestamp with time zone NOT NULL,
	"time_spent_seconds" integer,
	"device_info" jsonb,
	"push_channel" "push_channel" NOT NULL,
	"is_review" boolean DEFAULT false NOT NULL,
	"previous_feedback_score" integer,
	"card_presentation_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "card_feedback" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "card_feedback" ADD CONSTRAINT "card_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_feedback" ADD CONSTRAINT "card_feedback_learning_product_id_learning_product_id_fk" FOREIGN KEY ("learning_product_id") REFERENCES "public"."learning_product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_feedback" ADD CONSTRAINT "card_feedback_learning_content_id_learning_content_id_fk" FOREIGN KEY ("learning_content_id") REFERENCES "public"."learning_content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_feedback" ADD CONSTRAINT "card_feedback_learning_card_id_learning_card_id_fk" FOREIGN KEY ("learning_card_id") REFERENCES "public"."learning_card"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_feedback_user_created_at_idx" ON "card_feedback" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "card_feedback_user_idx" ON "card_feedback" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "card_feedback_learning_product_idx" ON "card_feedback" USING btree ("learning_product_id");--> statement-breakpoint
CREATE INDEX "card_feedback_learning_content_idx" ON "card_feedback" USING btree ("learning_content_id");--> statement-breakpoint
CREATE INDEX "card_feedback_learning_card_idx" ON "card_feedback" USING btree ("learning_card_id");--> statement-breakpoint
CREATE INDEX "card_feedback_user_product_idx" ON "card_feedback" USING btree ("user_id","learning_product_id");--> statement-breakpoint
CREATE INDEX "card_feedback_user_content_idx" ON "card_feedback" USING btree ("user_id","learning_content_id");--> statement-breakpoint
CREATE INDEX "card_feedback_user_card_idx" ON "card_feedback" USING btree ("user_id","learning_card_id");--> statement-breakpoint
CREATE INDEX "card_feedback_score_idx" ON "card_feedback" USING btree ("feedback_score");--> statement-breakpoint
CREATE INDEX "card_feedback_is_review_idx" ON "card_feedback" USING btree ("is_review");--> statement-breakpoint
CREATE POLICY "card_feedback_select_own" ON "card_feedback" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("card_feedback"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "card_feedback_select_admin" ON "card_feedback" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "card_feedback_insert_own" ON "card_feedback" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("card_feedback"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "card_feedback_insert_admin" ON "card_feedback" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "card_feedback_update_none" ON "card_feedback" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "card_feedback_delete_none" ON "card_feedback" AS PERMISSIVE FOR DELETE TO "authenticated" USING (false);