/**
 * Language product sub-category utilities.
 *
 * Sub-groups language-category products by meta.language and meta.story.
 * Used in: landing product grid, /products language section.
 */

export type ProductCategory = 'de' | 'es' | 'en' | 'ja' | 'story';

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  de:    '🇩🇪 독일어',
  es:    '🇪🇸 스페인어',
  en:    '🇬🇧 영어',
  ja:    '🇯🇵 일본어',
  story: '📖 Story',
};

export const CATEGORY_ORDER: ProductCategory[] = ['de', 'es', 'en', 'ja', 'story'];

const CEFR_ORDER = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

function extractMeta(meta: unknown): Record<string, unknown> {
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    return meta as Record<string, unknown>;
  }
  return {};
}

export function getProductCategory(meta: unknown): ProductCategory {
  const m = extractMeta(meta);
  if (m.story) return 'story';
  if (typeof m.language === 'string') {
    const lang = m.language as ProductCategory;
    if (['de', 'es', 'en', 'ja'].includes(lang)) return lang;
  }
  return 'de';
}

export function groupProductsByCategory<T extends { meta: unknown }>(
  products: T[]
): Record<ProductCategory, T[]> {
  const groups = Object.fromEntries(
    CATEGORY_ORDER.map(cat => [cat, [] as T[]])
  ) as Record<ProductCategory, T[]>;

  for (const product of products) {
    groups[getProductCategory(product.meta)].push(product);
  }

  // Sort each language group by CEFR level ascending
  for (const cat of CATEGORY_ORDER) {
    if (cat === 'story') continue;
    groups[cat].sort((a, b) => {
      const la = extractMeta(a.meta).level as string | undefined ?? '';
      const lb = extractMeta(b.meta).level as string | undefined ?? '';
      const ia = CEFR_ORDER.indexOf(la);
      const ib = CEFR_ORDER.indexOf(lb);
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }

  return groups;
}
