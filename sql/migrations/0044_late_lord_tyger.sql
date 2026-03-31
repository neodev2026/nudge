DROP INDEX "nv2_stage_progress_user_stage_uidx";--> statement-breakpoint
CREATE INDEX "nv2_stage_progress_user_stage_uidx" ON "nv2_stage_progress" USING btree ("sns_type","sns_id","stage_id");--> statement-breakpoint
ALTER POLICY "nv2_stage_progress_select_own" ON "nv2_stage_progress" TO public USING (true);