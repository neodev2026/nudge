/**
 * Encoder/decoder for nv2_schedules.message_body of type hyper_sync_review.
 *
 * Format (pipe-delimited):
 *   hyper_sync|{product_slug}|{source_session_id}|{card_id1,card_id2,...}|{total_unknown}
 *
 * stage_id is null on the schedule row; all routing info lives in this string.
 */

export interface HyperSyncMessageBody {
  productSlug: string;
  sourceSessionId: string;
  cardIds: string[];
  totalUnknown: number;
}

const PREFIX = "hyper_sync";

export function serializeHyperSyncMessageBody(body: HyperSyncMessageBody): string {
  const ids = body.cardIds.join(",");
  return `${PREFIX}|${body.productSlug}|${body.sourceSessionId}|${ids}|${body.totalUnknown}`;
}

export function parseHyperSyncMessageBody(
  raw: string | null | undefined
): HyperSyncMessageBody | null {
  if (!raw) return null;
  const parts = raw.split("|");
  if (parts.length < 5) return null;
  if (parts[0] !== PREFIX) return null;

  const [, productSlug, sourceSessionId, idsPart, totalStr] = parts;
  if (!productSlug || !sourceSessionId) return null;

  const cardIds = idsPart ? idsPart.split(",").filter(Boolean) : [];
  const totalUnknown = Number.parseInt(totalStr ?? "0", 10);
  if (!Number.isFinite(totalUnknown)) return null;

  return { productSlug, sourceSessionId, cardIds, totalUnknown };
}
