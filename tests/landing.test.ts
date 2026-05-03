import { describe, it, expect } from "vitest";
import { getTrialMarathonHref } from "../app/features/v2/home/screens/home-page";

describe("getTrialMarathonHref", () => {
  it("TC-LP-06: spanish-a1 slug → 마라톤 URL 생성", () => {
    expect(getTrialMarathonHref("spanish-a1")).toBe("/products/spanish-a1/marathon");
  });

  it("slug 변경 시 URL도 변경됨", () => {
    expect(getTrialMarathonHref("deutsch-a1")).toBe("/products/deutsch-a1/marathon");
  });

  it("빈 slug → 빈 경로 처리", () => {
    expect(getTrialMarathonHref("")).toBe("/products//marathon");
    // 빈 slug는 TRIAL_MARATHON_SLUG 상수로 방지
  });
});
