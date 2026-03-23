CREATE TABLE "lite_content_progress" (
	"progress_id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lite_content_progress_progress_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"sns_type" "sns_type" NOT NULL,
	"sns_id" varchar NOT NULL,
	"learning_product_id" uuid NOT NULL,
	"current_content_id" uuid,
	"last_card_id" uuid,
	"completed_cards_count" integer DEFAULT 0 NOT NULL,
	"total_cards_count" integer DEFAULT 0 NOT NULL,
	"last_feedback_score" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lite_profiles" (
	"sns_type" "sns_type" NOT NULL,
	"sns_id" varchar NOT NULL,
	"subscription_status" varchar DEFAULT 'active',
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lite_profiles_sns_type_sns_id_pk" PRIMARY KEY("sns_type","sns_id")
);
--> statement-breakpoint
ALTER TABLE "lite_content_progress" ADD CONSTRAINT "lite_content_progress_sns_type_sns_id_lite_profiles_sns_type_sns_id_fk" FOREIGN KEY ("sns_type","sns_id") REFERENCES "public"."lite_profiles"("sns_type","sns_id") ON DELETE cascade ON UPDATE no action;