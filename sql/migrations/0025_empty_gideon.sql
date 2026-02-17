ALTER TYPE "public"."card_delivery_status" ADD VALUE 'retry_required' BEFORE 'failed';--> statement-breakpoint
ALTER TABLE "card_delivery_queue" ADD COLUMN "next_retry_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "card_delivery_retry_worker_idx" ON "card_delivery_queue" USING btree ("status","next_retry_at");