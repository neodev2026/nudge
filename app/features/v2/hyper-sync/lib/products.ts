/**
 * Single source of truth for which products participate in Hyper-Sync.
 *
 * Kept in a non-route lib file so both the landing page (renders one box
 * per slug) and the session page (validates inbound productId against
 * the list) can import without crossing route module boundaries. Direct
 * cross-route imports work in dev but can cause production bundle/chunk
 * surprises in React Router 7 — keep route files self-contained.
 *
 * To add a new product to Hyper-Sync: append its slug here and register
 * the product + missions + cards in the admin UI. No other code change.
 */
export const HYPER_SYNC_PRODUCT_SLUGS = [
  "developer-english",
  "deutsch-alltag-und-beruf-a2",
  "deutsch-alltag-und-beruf-b1",
] as const;

export type HyperSyncProductSlug = (typeof HYPER_SYNC_PRODUCT_SLUGS)[number];

/** True when slug is one of the products enrolled in Hyper-Sync. */
export function isHyperSyncProductSlug(
  slug: string | undefined
): slug is HyperSyncProductSlug {
  return (
    !!slug && (HYPER_SYNC_PRODUCT_SLUGS as readonly string[]).includes(slug)
  );
}

/**
 * Builds the small subtitle shown next to a product name (e.g. "DE · A2").
 * Returns "" when the product has no language meta. Shared by the landing
 * page (product cards) and the per-product mission list page.
 */
export function getProductSubtitle(
  category: string | null | undefined,
  meta: unknown
): string {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return "";
  const m = meta as Record<string, unknown>;
  if (category === "language") {
    const lang = typeof m.language === "string" ? m.language.toUpperCase() : "";
    const level = typeof m.level === "string" ? m.level : "";
    return [lang, level].filter(Boolean).join(" · ");
  }
  return "";
}
