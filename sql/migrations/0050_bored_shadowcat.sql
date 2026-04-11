CREATE TYPE "public"."nv2_chat_message_type" AS ENUM('text', 'card', 'quiz', 'writing_prompt', 'dictation', 'feedback');--> statement-breakpoint
CREATE TYPE "public"."nv2_chat_role" AS ENUM('leni', 'user');--> statement-breakpoint
CREATE TABLE "nv2_chat_turns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" text NOT NULL,
	"session_id" uuid,
	"role" "nv2_chat_role" NOT NULL,
	"message_type" "nv2_chat_message_type" DEFAULT 'text' NOT NULL,
	"content" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nv2_chat_turns" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "nv2_turn_balance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" text NOT NULL,
	"subscription_turns" integer DEFAULT 0 NOT NULL,
	"subscription_reset_at" timestamp with time zone,
	"charged_turns" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nv2_turn_balance_auth_user_id_unique" UNIQUE("auth_user_id")
);
--> statement-breakpoint
ALTER TABLE "nv2_turn_balance" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "nv2_chat_turns" ADD CONSTRAINT "nv2_chat_turns_session_id_nv2_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."nv2_sessions"("session_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "nv2_chat_turns_user_idx" ON "nv2_chat_turns" USING btree ("auth_user_id");--> statement-breakpoint
CREATE INDEX "nv2_chat_turns_session_idx" ON "nv2_chat_turns" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "nv2_chat_turns_created_idx" ON "nv2_chat_turns" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "nv2_turn_balance_user_idx" ON "nv2_turn_balance" USING btree ("auth_user_id");--> statement-breakpoint
CREATE POLICY "nv2_chat_turns_select_own" ON "nv2_chat_turns" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("nv2_chat_turns"."auth_user_id" = auth.uid()::text);--> statement-breakpoint
CREATE POLICY "nv2_chat_turns_insert_own" ON "nv2_chat_turns" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("nv2_chat_turns"."auth_user_id" = auth.uid()::text);--> statement-breakpoint
CREATE POLICY "nv2_chat_turns_admin_all" ON "nv2_chat_turns" AS PERMISSIVE FOR ALL TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "nv2_chat_turns_service_all" ON "nv2_chat_turns" AS PERMISSIVE FOR ALL TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "nv2_turn_balance_select_own" ON "nv2_turn_balance" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("nv2_turn_balance"."auth_user_id" = auth.uid()::text);--> statement-breakpoint
CREATE POLICY "nv2_turn_balance_admin_all" ON "nv2_turn_balance" AS PERMISSIVE FOR ALL TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "nv2_turn_balance_service_all" ON "nv2_turn_balance" AS PERMISSIVE FOR ALL TO "service_role" USING (true);