import { describe, it, expect } from 'vitest';
import {
  getProductCategory,
  groupProductsByCategory,
  CATEGORY_ORDER,
} from '../app/features/v2/products/lib/product-categories';

describe('getProductCategory', () => {
  it('TC-LA-12: story meta → story 카테고리', () => {
    expect(getProductCategory({ story: 'cinderella', language: 'de' })).toBe('story');
  });

  it('TC-LA-12: story=true → story 카테고리', () => {
    expect(getProductCategory({ story: true, language: 'de' })).toBe('story');
  });

  it('TC-LA-08: language=de → de 카테고리', () => {
    expect(getProductCategory({ language: 'de' })).toBe('de');
  });

  it('TC-LA-10: language=en → en 카테고리', () => {
    expect(getProductCategory({ language: 'en' })).toBe('en');
  });

  it('TC-LA-09: language=es → es 카테고리', () => {
    expect(getProductCategory({ language: 'es' })).toBe('es');
  });

  it('TC-LA-11: language=ja → ja 카테고리', () => {
    expect(getProductCategory({ language: 'ja' })).toBe('ja');
  });

  it('null meta → 기본값 de', () => {
    expect(getProductCategory(null)).toBe('de');
  });

  it('undefined meta → 기본값 de', () => {
    expect(getProductCategory(undefined)).toBe('de');
  });
});

describe('groupProductsByCategory', () => {
  const mockProducts = [
    { id: '1', meta: { language: 'de', level: 'A1' }, slug: 'deutsch-a1' },
    { id: '2', meta: { language: 'de', level: 'A2' }, slug: 'deutsch-a2' },
    { id: '3', meta: { language: 'es', level: 'A1' }, slug: 'spanish-a1' },
    { id: '4', meta: { language: 'de', story: true }, slug: 'story-deutsch-b1' },
  ];

  it('TC-LA-13: story 상품이 de 카테고리에 포함되지 않음', () => {
    const grouped = groupProductsByCategory(mockProducts);
    expect(grouped.de.map(p => p.slug)).not.toContain('story-deutsch-b1');
  });

  it('TC-LA-12: story 상품이 story 카테고리에 포함됨', () => {
    const grouped = groupProductsByCategory(mockProducts);
    expect(grouped.story.map(p => p.slug)).toContain('story-deutsch-b1');
  });

  it('TC-LA-14: de 카테고리 내 A1 → A2 오름차순 정렬', () => {
    const grouped = groupProductsByCategory(mockProducts);
    const deSlugs = grouped.de.map(p => p.slug);
    expect(deSlugs.indexOf('deutsch-a1')).toBeLessThan(deSlugs.indexOf('deutsch-a2'));
  });

  it('카테고리 순서: de가 story보다 앞', () => {
    expect(CATEGORY_ORDER.indexOf('de')).toBeLessThan(CATEGORY_ORDER.indexOf('story'));
  });

  it('카테고리 순서: es가 story보다 앞', () => {
    expect(CATEGORY_ORDER.indexOf('es')).toBeLessThan(CATEGORY_ORDER.indexOf('story'));
  });

  it('비어있는 카테고리도 빈 배열로 반환', () => {
    const grouped = groupProductsByCategory(mockProducts);
    expect(grouped.ja).toEqual([]);
    expect(grouped.en).toEqual([]);
  });
});
