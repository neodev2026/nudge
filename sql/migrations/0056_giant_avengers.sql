CREATE POLICY "nv2_profiles_n8n_select" ON "nv2_profiles" AS PERMISSIVE FOR SELECT TO "n8n_worker" USING (true);--> statement-breakpoint
CREATE POLICY "nv2_schedules_n8n_select" ON "nv2_schedules" AS PERMISSIVE FOR SELECT TO "n8n_worker" USING (true);--> statement-breakpoint
CREATE POLICY "nv2_schedules_n8n_insert" ON "nv2_schedules" AS PERMISSIVE FOR INSERT TO "n8n_worker" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "nv2_product_sessions_n8n_select" ON "nv2_product_sessions" AS PERMISSIVE FOR SELECT TO "n8n_worker" USING (true);