CREATE TYPE "public"."lite_card_delivery_status" AS ENUM('pending', 'sent', 'retry_required', 'failed', 'cancelled', 'opened', 'feedback_received');--> statement-breakpoint
CREATE TABLE "lite_card_deliveries" (
	"delivery_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sns_type" varchar NOT NULL,
	"sns_id" varchar NOT NULL,
	"learning_product_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"previous_delivery_id" uuid,
	"status" "lite_card_delivery_status" DEFAULT 'pending' NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"opened_at" timestamp with time zone,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"next_retry_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
