CREATE TYPE "public"."card_delivery_status" AS ENUM('pending', 'sent', 'failed', 'cancelled', 'opened', 'feedback_received');--> statement-breakpoint
CREATE TABLE "card_delivery_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"learning_card_id" uuid NOT NULL,
	"previous_delivery_id" uuid,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" "card_delivery_status" DEFAULT 'pending' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"sent_at" timestamp with time zone,
	"opened_at" timestamp with time zone,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "card_delivery_queue" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "card_delivery_queue" ADD CONSTRAINT "card_delivery_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_delivery_queue" ADD CONSTRAINT "card_delivery_queue_connection_id_user_sns_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."user_sns_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_delivery_queue" ADD CONSTRAINT "card_delivery_queue_learning_card_id_learning_card_id_fk" FOREIGN KEY ("learning_card_id") REFERENCES "public"."learning_card"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_delivery_worker_batch_idx" ON "card_delivery_queue" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "card_delivery_user_history_idx" ON "card_delivery_queue" USING btree ("user_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "card_delivery_engagement_idx" ON "card_delivery_queue" USING btree ("status","opened_at");--> statement-breakpoint
CREATE POLICY "card_delivery_admin_all" ON "card_delivery_queue" AS PERMISSIVE FOR ALL TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "card_delivery_worker_manage" ON "card_delivery_queue" AS PERMISSIVE FOR ALL TO "n8n_worker" USING (true) WITH CHECK (true);