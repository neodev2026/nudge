ALTER TABLE "nv2_marathon_seasons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "nv2_marathon_seasons_select_public" ON "nv2_marathon_seasons" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "nv2_marathon_seasons_insert_admin" ON "nv2_marathon_seasons" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "nv2_marathon_seasons_update_admin" ON "nv2_marathon_seasons" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "nv2_marathon_seasons_delete_admin" ON "nv2_marathon_seasons" AS PERMISSIVE FOR DELETE TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
CREATE POLICY "nv2_marathon_seasons_service_all" ON "nv2_marathon_seasons" AS PERMISSIVE FOR ALL TO "service_role" USING (true);