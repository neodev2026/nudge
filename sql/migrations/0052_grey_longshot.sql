CREATE TABLE "nv2_site_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"maintenance_mode" boolean DEFAULT false NOT NULL,
	"maintenance_message" text DEFAULT '서비스 점검 중입니다. 잠시 후 다시 이용해주세요.' NOT NULL,
	"maintenance_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nv2_site_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "nv2_site_settings_check_single_row" ON "nv2_site_settings" AS PERMISSIVE FOR ALL TO public USING ("nv2_site_settings"."id" = 1);--> statement-breakpoint
CREATE POLICY "nv2_site_settings_service_all" ON "nv2_site_settings" AS PERMISSIVE FOR ALL TO "service_role" USING (true);