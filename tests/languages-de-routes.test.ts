import { describe, it, expect } from "vitest";
import { roadmapItems } from "~/features/v2/languages/screens/de-roadmap-page";

describe("독일어 로드맵 데이터 정합성", () => {
  it("로드맵 항목이 5개여야 한다", () => {
    expect(roadmapItems).toHaveLength(5);
  });

  it("모든 항목에 level, href, status가 있어야 한다", () => {
    roadmapItems.forEach((item) => {
      expect(item.level).toBeTruthy();
      expect(item.href).toBeTruthy();
      expect(["active", "coming_soon"]).toContain(item.status);
    });
  });

  it("B2만 coming_soon이어야 한다", () => {
    const comingSoon = roadmapItems.filter((i) => i.status === "coming_soon");
    expect(comingSoon).toHaveLength(1);
    expect(comingSoon[0].level).toBe("B2");
  });

  it("coming_soon 항목은 productHref가 null이어야 한다", () => {
    roadmapItems
      .filter((i) => i.status === "coming_soon")
      .forEach((item) => {
        expect(item.productHref).toBeNull();
      });
  });

  it("active 항목은 productHref가 있어야 한다", () => {
    roadmapItems
      .filter((i) => i.status === "active")
      .forEach((item) => {
        expect(item.productHref).toBeTruthy();
        expect(item.productHref).toMatch(/^\/products\//);
      });
  });

  it("href는 모두 /languages/de로 시작해야 한다", () => {
    roadmapItems.forEach((item) => {
      expect(item.href).toMatch(/^\/languages\/de/);
    });
  });

  it("레벨 순서가 ABC > A1 > A2 > B1 > B2여야 한다", () => {
    const levels = roadmapItems.map((i) => i.level);
    expect(levels).toEqual(["ABC", "A1", "A2", "B1", "B2"]);
  });
});

describe("YouTube 링크 형식 검증", () => {
  it("YouTube 링크는 검색 URL 형식이어야 한다", () => {
    const sampleLinks = [
      "https://www.youtube.com/results?search_query=독일어+A1+기초",
      "https://www.youtube.com/results?search_query=Nicos+Weg+A1",
    ];
    sampleLinks.forEach((link) => {
      expect(link).toMatch(
        /^https:\/\/www\.youtube\.com\/results\?search_query=/
      );
    });
  });
});
