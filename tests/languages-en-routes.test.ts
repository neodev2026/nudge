import { describe, it, expect } from "vitest";
import { roadmapItems } from "~/features/v2/languages/screens/en-roadmap-page";

describe("영어 로드맵 데이터 정합성", () => {
  it("로드맵 항목이 4개여야 한다 (A1 + A2 + B1 + B2)", () => {
    expect(roadmapItems).toHaveLength(4);
  });

  it("모든 항목에 level, href, status가 있어야 한다", () => {
    roadmapItems.forEach((item) => {
      expect(item.level).toBeTruthy();
      expect(item.href).toBeTruthy();
      expect(["active", "coming_soon"]).toContain(item.status);
    });
  });

  it("coming_soon 항목이 없어야 한다 (영어는 전부 운영 중)", () => {
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
      expect(item.productHref).toMatch(/^\/products\/english-/);
    });
  });

  it("첫 번째 항목은 A1이어야 한다", () => {
    expect(roadmapItems[0].level).toBe("A1");
    expect(roadmapItems[0].productHref).toBe("/products/english-a1");
  });

  it("href는 모두 /languages/en/로 시작해야 한다", () => {
    roadmapItems.forEach((item) => {
      expect(item.href).toMatch(/^\/languages\/en\//);
    });
  });

  it("레벨 순서가 A1 > A2 > B1 > B2여야 한다", () => {
    const levels = roadmapItems.map((i) => i.level);
    expect(levels).toEqual(["A1", "A2", "B1", "B2"]);
  });

  it("A1 단어 수는 884개여야 한다", () => {
    const a1 = roadmapItems.find((i) => i.level === "A1")!;
    expect(a1.units).toBe(884);
  });

  it("B2 단어 수가 가장 적어야 한다 (Oxford 3000 특성)", () => {
    const b2 = roadmapItems.find((i) => i.level === "B2")!;
    roadmapItems.forEach((item) => {
      if (item.level !== "B2") {
        expect(item.units).toBeGreaterThan(b2.units);
      }
    });
  });

  it("ABC 항목이 없어야 한다 (영어는 알파벳 페이지 없음)", () => {
    const abc = roadmapItems.find((i) => i.level === "ABC");
    expect(abc).toBeUndefined();
  });
});
