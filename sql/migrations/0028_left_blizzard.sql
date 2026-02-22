DROP POLICY "user_progress_select_admin" ON "user_learning_content_progress" CASCADE;--> statement-breakpoint
DROP POLICY "user_progress_insert_admin" ON "user_learning_content_progress" CASCADE;--> statement-breakpoint
DROP POLICY "user_progress_update_admin" ON "user_learning_content_progress" CASCADE;--> statement-breakpoint
DROP POLICY "user_progress_delete_admin" ON "user_learning_content_progress" CASCADE;--> statement-breakpoint
CREATE POLICY "user_progress_worker_manage" ON "user_learning_content_progress" AS PERMISSIVE FOR ALL TO "n8n_worker" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "user_progress_admin_all" ON "user_learning_content_progress" AS PERMISSIVE FOR ALL TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);