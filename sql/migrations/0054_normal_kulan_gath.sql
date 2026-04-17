CREATE TYPE "public"."nv2_subscription_source" AS ENUM('paid', 'free', 'admin');--> statement-breakpoint
ALTER TABLE "nv2_learning_products" ADD COLUMN "price" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "nv2_subscriptions" ADD COLUMN "source" "nv2_subscription_source" DEFAULT 'free' NOT NULL;