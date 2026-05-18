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
