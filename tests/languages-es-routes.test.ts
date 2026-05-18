import { describe, it, expect } from "vitest";
import { roadmapItems } from "~/features/v2/languages/screens/es-roadmap-page";

describe("스페인어 로드맵 데이터 정합성", () => {
  it("로드맵 항목이 5개여야 한다 (ABC + A1 + A2 + B1 + B2)", () => {
    expect(roadmapItems).toHaveLength(5);
  });

  it("모든 항목에 level, href, status가 있어야 한다", () => {
    roadmapItems.forEach((item) => {
      expect(item.level).toBeTruthy();
      expect(item.href).toBeTruthy();
      expect(["active", "coming_soon"]).toContain(item.status);
    });
  });

  it("coming_soon 항목이 없어야 한다 (스페인어는 전부 운영 중)", () => {
    const comingSoon = roadmapItems.filter((i) => i.status === "coming_soon");
    expect(comingSoon).toHaveLength(0);
  });

  it("모든 항목이 active이어야 한다", () => {
    roadmapItems.forEach((item) => {
      expect(item.status).toBe("active");
    });
  });

  it("모든 항목에 productHref가 있어야 한다", () => {
    roadmapItems.forEach((item) => {
      expect(item.productHref).toBeTruthy();
      expect(item.productHref).toMatch(/^\/products\/spanish-/);
    });
  });

  it("첫 번째 항목은 ABC여야 한다", () => {
    expect(roadmapItems[0].level).toBe("ABC");
    expect(roadmapItems[0].productHref).toBe("/products/spanish-abc");
  });

  it("href는 모두 /languages/es/로 시작해야 한다", () => {
    roadmapItems.forEach((item) => {
      expect(item.href).toMatch(/^\/languages\/es\//);
    });
  });

  it("레벨 순서가 ABC > A1 > A2 > B1 > B2여야 한다", () => {
    const levels = roadmapItems.map((i) => i.level);
    expect(levels).toEqual(["ABC", "A1", "A2", "B1", "B2"]);
  });

  it("A2 단어 수가 A1보다 많아야 한다 (PCIC 기준 특성)", () => {
    const a1 = roadmapItems.find((i) => i.level === "A1")!;
    const a2 = roadmapItems.find((i) => i.level === "A2")!;
    expect(a2.units).toBeGreaterThan(a1.units);
  });

  it("ABC 항목은 unitLabel이 단어가 아닌 발음 단위여야 한다", () => {
    const abc = roadmapItems.find((i) => i.level === "ABC")!;
    expect(abc.unitLabel).toBe("발음 단위");
  });
});
