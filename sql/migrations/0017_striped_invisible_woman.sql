CREATE TABLE "learning_content_progress" (
	"user_id" uuid NOT NULL,
	"learning_content_id" uuid NOT NULL,
	"iteration" integer DEFAULT 0 NOT NULL,
	"easiness" double precision DEFAULT 2.5 NOT NULL,
	"interval" integer DEFAULT 0 NOT NULL,
	"current_card_index" integer DEFAULT 0 NOT NULL,
	"next_review_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_review_at" timestamp with time zone,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "learning_content_progress_unique" UNIQUE("user_id","learning_content_id")
);
--> statement-breakpoint
ALTER TABLE "learning_content_progress" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "learning_content_progress" ADD CONSTRAINT "learning_content_progress_learning_content_id_learning_content_id_fk" FOREIGN KEY ("learning_content_id") REFERENCES "public"."learning_content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "learning_content_progress_user_manage" ON "learning_content_progress" AS PERMISSIVE FOR ALL TO "authenticated" USING ("learning_content_progress"."user_id" = (select auth.uid())) WITH CHECK ("learning_content_progress"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "learning_content_progress_worker_all" ON "learning_content_progress" AS PERMISSIVE FOR ALL TO "n8n_worker" USING (true) WITH CHECK (true);