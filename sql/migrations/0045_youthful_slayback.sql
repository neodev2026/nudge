DROP POLICY "nv2_sessions_select_public" ON "nv2_sessions" CASCADE;--> statement-breakpoint
CREATE POLICY "nv2_product_session_stages_n8n_insert" ON "nv2_product_session_stages" AS PERMISSIVE FOR INSERT TO "n8n_worker" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "nv2_product_sessions_n8n_insert" ON "nv2_product_sessions" AS PERMISSIVE FOR INSERT TO "n8n_worker" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "nv2_cards_n8n_insert" ON "nv2_cards" AS PERMISSIVE FOR INSERT TO "n8n_worker" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "nv2_stages_n8n_insert" ON "nv2_stages" AS PERMISSIVE FOR INSERT TO "n8n_worker" WITH CHECK (true);