DROP INDEX "nv2_stages_type_idx";--> statement-breakpoint
ALTER TABLE "nv2_stages" ADD COLUMN "is_welcome" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "nv2_stages" DROP COLUMN "stage_type";--> statement-breakpoint
ALTER POLICY "nv2_cards_select_active" ON "nv2_cards" TO public USING ("nv2_cards"."is_active" = true);--> statement-breakpoint
ALTER POLICY "nv2_stages_select_active" ON "nv2_stages" TO public USING ("nv2_stages"."is_active" = true);--> statement-breakpoint
DROP TYPE "public"."nv2_stage_type";