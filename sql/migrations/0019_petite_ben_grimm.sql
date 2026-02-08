ALTER TABLE "user_sns_connection" ADD COLUMN "verification_token" text;--> statement-breakpoint
ALTER TABLE "user_sns_connection" ADD COLUMN "token_expires_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "user_sns_token_idx" ON "user_sns_connection" USING btree ("verification_token");