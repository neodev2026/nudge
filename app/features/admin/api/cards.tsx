/**
 * POST /admin/api/cards/upsert
 *
 * Creates or updates a card.
 * Assembles V2CardData from individual form fields.
 */
import { data as routeData } from "react-router";
import type { Route } from "./+types/cards";

import makeServerClient from "~/core/lib/supa-client.server";
import { requireAdmin } from "~/features/admin/lib/guards.server";
import { adminUpsertCard } from "~/features/admin/lib/queries.server";
import type { V2CardData } from "~/features/v2/shared/types";

export async function action({ request }: Route.ActionArgs) {
  const [client] = makeServerClient(request);
  await requireAdmin(client, request);

  const form_data = await request.formData();
  const id = form_data.get("id") as string | null;
  const stage_id = form_data.get("stage_id") as string;
  const card_type = form_data.get("card_type") as string;
  const display_order = Number(form_data.get("display_order"));
  const is_active = form_data.get("is_active") === "true";

  // Presentation fields
  const front = form_data.get("front") as string;
  const back = (form_data.get("back") as string) || "";
  const hint = (form_data.get("hint") as string) || undefined;

  // Details fields
  const explanation = (form_data.get("explanation") as string) || "";
  const example_sentence = (form_data.get("example_sentence") as string) || "";
  const example_translation = (form_data.get("example_translation") as string) || "";

  // Meta fields
  const target_locale = (form_data.get("target_locale") as string) || "de";
  const learner_locale = (form_data.get("learner_locale") as string) || "ko";
  // logic_key is always set to stage_id so all cards in the same stage
  // share the same key — required for quiz title ↔ description matching.
  const logic_key = stage_id;

  if (!stage_id || !card_type || !front) {
    return routeData({ error: "필수 항목이 누락됐습니다." }, { status: 400 });
  }

  const card_data: V2CardData = {
    presentation: {
      front,
      back,
      ...(hint ? { hint } : {}),
    },
    details: {
      explanation,
      ...(example_sentence
        ? {
            example_context: {
              sentence: example_sentence,
              translation: example_translation,
            },
          }
        : {}),
    },
    meta: {
      target_locale,
      learner_locale,
      logic_key,
    },
  };

  await adminUpsertCard(client, {
    ...(id ? { id } : {}),
    stage_id,
    card_type,
    display_order,
    card_data: card_data as unknown as Record<string, unknown>,
    is_active,
  });

  return routeData({ ok: true });
}
