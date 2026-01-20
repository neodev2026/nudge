CREATE TYPE "public"."delivery_status" AS ENUM('pending', 'sent', 'failed', 'opened', 'feedback_received');--> statement-breakpoint
CREATE TYPE "public"."sns_type" AS ENUM('discord', 'kakao', 'email');--> statement-breakpoint
CREATE TABLE "card_schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"user_sns_connection_id" uuid NOT NULL,
	"learning_product_id" uuid NOT NULL,
	"learning_content_id" uuid NOT NULL,
	"learning_card_id" uuid NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"delivery_status" "delivery_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"previous_schedule_id" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "card_schedule" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_learning_content_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"learning_product_id" uuid NOT NULL,
	"learning_content_id" uuid NOT NULL,
	"last_studied_at" timestamp with time zone,
	"study_count" integer DEFAULT 0 NOT NULL,
	"last_feedback_score" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_content_progress_unique" UNIQUE("user_id","learning_product_id","learning_content_id")
);
--> statement-breakpoint
ALTER TABLE "user_learning_content_progress" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_product_subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"learning_product_id" uuid NOT NULL,
	"user_sns_connection_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"push_enabled" boolean DEFAULT true NOT NULL,
	"memory_percentage" integer DEFAULT 0 NOT NULL,
	"preferred_push_time" time,
	"subscribed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unsubscribed_at" timestamp with time zone,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_product_subscription_unique" UNIQUE("user_id","learning_product_id")
);
--> statement-breakpoint
ALTER TABLE "user_product_subscription" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_sns_connection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"sns_type" "sns_type" NOT NULL,
	"sns_identifier" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"push_enabled" boolean DEFAULT true NOT NULL,
	"verified_at" timestamp with time zone,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_sns_connection_unique" UNIQUE("user_id","sns_type","sns_identifier")
);
--> statement-breakpoint
ALTER TABLE "user_sns_connection" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "card_schedule" ADD CONSTRAINT "card_schedule_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_schedule" ADD CONSTRAINT "card_schedule_user_sns_connection_id_user_sns_connection_id_fk" FOREIGN KEY ("user_sns_connection_id") REFERENCES "public"."user_sns_connection"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_schedule" ADD CONSTRAINT "card_schedule_learning_product_id_learning_product_id_fk" FOREIGN KEY ("learning_product_id") REFERENCES "public"."learning_product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_schedule" ADD CONSTRAINT "card_schedule_learning_content_id_learning_content_id_fk" FOREIGN KEY ("learning_content_id") REFERENCES "public"."learning_content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_schedule" ADD CONSTRAINT "card_schedule_learning_card_id_learning_card_id_fk" FOREIGN KEY ("learning_card_id") REFERENCES "public"."learning_card"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_schedule" ADD CONSTRAINT "card_schedule_previous_schedule_id_card_schedule_id_fk" FOREIGN KEY ("previous_schedule_id") REFERENCES "public"."card_schedule"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_learning_content_progress" ADD CONSTRAINT "user_learning_content_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_learning_content_progress" ADD CONSTRAINT "user_learning_content_progress_learning_product_id_learning_product_id_fk" FOREIGN KEY ("learning_product_id") REFERENCES "public"."learning_product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_learning_content_progress" ADD CONSTRAINT "user_learning_content_progress_learning_content_id_learning_content_id_fk" FOREIGN KEY ("learning_content_id") REFERENCES "public"."learning_content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_product_subscription" ADD CONSTRAINT "user_product_subscription_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_product_subscription" ADD CONSTRAINT "user_product_subscription_learning_product_id_learning_product_id_fk" FOREIGN KEY ("learning_product_id") REFERENCES "public"."learning_product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_product_subscription" ADD CONSTRAINT "user_product_subscription_user_sns_connection_id_user_sns_connection_id_fk" FOREIGN KEY ("user_sns_connection_id") REFERENCES "public"."user_sns_connection"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sns_connection" ADD CONSTRAINT "user_sns_connection_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_schedule_user_idx" ON "card_schedule" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "card_schedule_pending_idx" ON "card_schedule" USING btree ("delivery_status","scheduled_at");--> statement-breakpoint
CREATE INDEX "card_schedule_user_product_idx" ON "card_schedule" USING btree ("user_id","learning_product_id");--> statement-breakpoint
CREATE INDEX "card_schedule_user_content_idx" ON "card_schedule" USING btree ("user_id","learning_content_id");--> statement-breakpoint
CREATE INDEX "card_schedule_user_card_status_idx" ON "card_schedule" USING btree ("user_id","learning_card_id","delivery_status");--> statement-breakpoint
CREATE INDEX "card_schedule_sns_idx" ON "card_schedule" USING btree ("user_sns_connection_id");--> statement-breakpoint
CREATE INDEX "card_schedule_sent_at_idx" ON "card_schedule" USING btree ("user_id","sent_at");--> statement-breakpoint
CREATE INDEX "card_schedule_previous_idx" ON "card_schedule" USING btree ("previous_schedule_id");--> statement-breakpoint
CREATE INDEX "user_progress_user_idx" ON "user_learning_content_progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_progress_user_product_idx" ON "user_learning_content_progress" USING btree ("user_id","learning_product_id");--> statement-breakpoint
CREATE INDEX "user_progress_user_product_studied_idx" ON "user_learning_content_progress" USING btree ("user_id","learning_product_id","last_studied_at");--> statement-breakpoint
CREATE INDEX "user_progress_feedback_score_idx" ON "user_learning_content_progress" USING btree ("user_id","last_feedback_score");--> statement-breakpoint
CREATE INDEX "user_subscription_user_idx" ON "user_product_subscription" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_subscription_active_idx" ON "user_product_subscription" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE INDEX "user_subscription_push_enabled_idx" ON "user_product_subscription" USING btree ("push_enabled");--> statement-breakpoint
CREATE INDEX "user_subscription_sns_idx" ON "user_product_subscription" USING btree ("user_sns_connection_id");--> statement-breakpoint
CREATE INDEX "user_subscription_product_idx" ON "user_product_subscription" USING btree ("learning_product_id");--> statement-breakpoint
CREATE INDEX "user_sns_user_idx" ON "user_sns_connection" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_sns_primary_idx" ON "user_sns_connection" USING btree ("user_id","is_primary");--> statement-breakpoint
CREATE INDEX "user_sns_type_idx" ON "user_sns_connection" USING btree ("sns_type");--> statement-breakpoint
CREATE INDEX "user_sns_identifier_idx" ON "user_sns_connection" USING btree ("sns_identifier");--> statement-breakpoint
CREATE INDEX "user_sns_verified_idx" ON "user_sns_connection" USING btree ("user_id","verified_at");--> statement-breakpoint
CREATE POLICY "card_schedule_select_own" ON "card_schedule" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("card_schedule"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "card_schedule_select_admin" ON "card_schedule" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "card_schedule_insert_system" ON "card_schedule" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "card_schedule_insert_admin" ON "card_schedule" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "card_schedule_update_system" ON "card_schedule" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "card_schedule_update_admin" ON "card_schedule" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
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
CREATE POLICY "card_schedule_delete_admin" ON "card_schedule" AS PERMISSIVE FOR DELETE TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "user_progress_select_own" ON "user_learning_content_progress" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("user_learning_content_progress"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "user_progress_select_admin" ON "user_learning_content_progress" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "user_progress_insert_system" ON "user_learning_content_progress" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "user_progress_insert_admin" ON "user_learning_content_progress" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "user_progress_update_system" ON "user_learning_content_progress" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "user_progress_update_admin" ON "user_learning_content_progress" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
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
CREATE POLICY "user_progress_delete_admin" ON "user_learning_content_progress" AS PERMISSIVE FOR DELETE TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "user_subscription_select_own" ON "user_product_subscription" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("user_product_subscription"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "user_subscription_select_admin" ON "user_product_subscription" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "user_subscription_insert_own" ON "user_product_subscription" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("user_product_subscription"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "user_subscription_insert_admin" ON "user_product_subscription" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "user_subscription_update_own" ON "user_product_subscription" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("user_product_subscription"."user_id" = (select auth.uid())) WITH CHECK ("user_product_subscription"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "user_subscription_update_admin" ON "user_product_subscription" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
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
CREATE POLICY "user_subscription_delete_own" ON "user_product_subscription" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("user_product_subscription"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "user_subscription_delete_admin" ON "user_product_subscription" AS PERMISSIVE FOR DELETE TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "user_sns_select_own" ON "user_sns_connection" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("user_sns_connection"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "user_sns_select_admin" ON "user_sns_connection" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "user_sns_insert_own" ON "user_sns_connection" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("user_sns_connection"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "user_sns_insert_admin" ON "user_sns_connection" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "user_sns_update_own" ON "user_sns_connection" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("user_sns_connection"."user_id" = (select auth.uid())) WITH CHECK ("user_sns_connection"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "user_sns_update_admin" ON "user_sns_connection" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
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
CREATE POLICY "user_sns_delete_own" ON "user_sns_connection" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("user_sns_connection"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "user_sns_delete_admin" ON "user_sns_connection" AS PERMISSIVE FOR DELETE TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);