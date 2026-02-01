DROP INDEX "learning_card_user_context_idx";--> statement-breakpoint
ALTER TABLE "learning_card" ALTER COLUMN "is_active" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "learning_card" ADD COLUMN "is_valid" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "learning_card" ADD COLUMN "error_message" text;--> statement-breakpoint
CREATE INDEX "learning_card_validation_idx" ON "learning_card" USING btree ("is_valid") WHERE "learning_card"."is_valid" = false;--> statement-breakpoint
ALTER TABLE "learning_card" DROP COLUMN "personalization_context";--> statement-breakpoint
DROP POLICY "learning_card_n8n_worker_select" ON "learning_card" CASCADE;--> statement-breakpoint
DROP POLICY "learning_card_n8n_worker_insert" ON "learning_card" CASCADE;--> statement-breakpoint
CREATE POLICY "learning_card_n8n_worker_all" ON "learning_card" AS PERMISSIVE FOR ALL TO "authenticated" USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
);--> statement-breakpoint
ALTER POLICY "learning_card_select_scoped" ON "learning_card" TO authenticated USING (
        "learning_card"."is_active" = true AND 
        "learning_card"."is_valid" = true AND (
          "learning_card"."card_scope" = 'shared' OR 
          ("learning_card"."card_scope" = 'personalized' AND ("learning_card"."card_data"->'meta'->>'userId')::uuid = (select auth.uid()))
        )
      );

CREATE OR REPLACE FUNCTION handle_sign_up()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET SEARCH_PATH = ''
AS $$
BEGIN
    IF new.raw_app_meta_data IS NOT NULL AND new.raw_app_meta_data ? 'provider' THEN
        IF new.raw_app_meta_data ->> 'provider' = 'email' OR new.raw_app_meta_data ->> 'provider' = 'phone' THEN
            IF new.raw_user_meta_data ? 'name' THEN
                INSERT INTO public.profiles (profile_id, name, marketing_consent)
                VALUES (new.id, new.raw_user_meta_data ->> 'name', (new.raw_user_meta_data ->> 'marketing_consent')::boolean);
            ELSE
                INSERT INTO public.profiles (profile_id, name, marketing_consent)
                VALUES (new.id, 'Anonymous', TRUE);
            END IF;
        ELSE
            INSERT INTO public.profiles (profile_id, name, avatar_url, marketing_consent)
            VALUES (new.id, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'avatar_url', TRUE);
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER handle_sign_up
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION handle_sign_up();