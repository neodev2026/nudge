DROP INDEX "nv2_stage_progress_user_stage_uidx";--> statement-breakpoint
CREATE UNIQUE INDEX "nv2_stage_progress_user_stage_uidx" ON "nv2_stage_progress" USING btree ("sns_type","sns_id","stage_id");