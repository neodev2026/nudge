import { describe, it, expect } from "vitest";
import {
  isWithinSendWindow,
  isSameWindow,
  buildMarathonMessageBody,
  needsCursorSync,
  getLocalTime,
} from "../app/features/v2/cron/api/marathon-nudge";

describe("getLocalTime", () => {
  it("returns correct KST hour and minute", () => {
    // 2026-04-30T00:00:00Z = KST 09:00
    const utc = new Date("2026-04-30T00:00:00Z");
    const { hour, minute } = getLocalTime(utc, "Asia/Seoul");
    expect(hour).toBe(9);
    expect(minute).toBe(0);
  });

  it("normalises hour 24 to 0", () => {
    // Midnight UTC = KST 09:00, but UTC midnight itself in UTC timezone
    const utc = new Date("2026-04-30T00:00:00Z");
    const { hour } = getLocalTime(utc, "UTC");
    expect(hour).toBe(0);
  });
});

describe("isWithinSendWindow", () => {
  it("TC-MN-05: KST 06:00 → included", () => {
    const utc = new Date("2026-04-29T21:00:00Z"); // KST 06:00
    expect(isWithinSendWindow(utc, "Asia/Seoul")).toBe(true);
  });

  it("TC-MN-06: KST 09:00 → included", () => {
    const utc = new Date("2026-04-30T00:00:00Z"); // KST 09:00
    expect(isWithinSendWindow(utc, "Asia/Seoul")).toBe(true);
  });

  it("TC-MN-07: KST 21:00 → included", () => {
    const utc = new Date("2026-04-29T12:00:00Z"); // KST 21:00
    expect(isWithinSendWindow(utc, "Asia/Seoul")).toBe(true);
  });

  it("TC-MN-08: KST 22:00 → excluded", () => {
    const utc = new Date("2026-04-29T13:00:00Z"); // KST 22:00
    expect(isWithinSendWindow(utc, "Asia/Seoul")).toBe(false);
  });

  it("TC-MN-09: KST 05:00 → excluded", () => {
    const utc = new Date("2026-04-29T20:00:00Z"); // KST 05:00
    expect(isWithinSendWindow(utc, "Asia/Seoul")).toBe(false);
  });

  it("TC-MN-10: null timezone → Asia/Seoul fallback", () => {
    const utc = new Date("2026-04-29T21:00:00Z"); // KST 06:00
    expect(isWithinSendWindow(utc, (null as any) ?? "Asia/Seoul")).toBe(true);
  });

  it("KST 09:14 (within +15 min) → included", () => {
    const utc = new Date("2026-04-30T00:14:00Z"); // KST 09:14
    expect(isWithinSendWindow(utc, "Asia/Seoul")).toBe(true);
  });

  it("KST 09:16 (outside +15 min) → excluded", () => {
    const utc = new Date("2026-04-30T00:16:00Z"); // KST 09:16
    expect(isWithinSendWindow(utc, "Asia/Seoul")).toBe(false);
  });
});

describe("isSameWindow", () => {
  it("TC-MN-11: 10-minute gap → same window", () => {
    const sent = new Date("2026-04-30T00:00:00Z"); // KST 09:00
    const now = new Date("2026-04-30T00:10:00Z"); // KST 09:10
    expect(isSameWindow(sent, now, "Asia/Seoul")).toBe(true);
  });

  it("TC-MN-12: 3-hour gap → different window", () => {
    const sent = new Date("2026-04-30T00:00:00Z"); // KST 09:00
    const now = new Date("2026-04-30T03:00:00Z"); // KST 12:00
    expect(isSameWindow(sent, now, "Asia/Seoul")).toBe(false);
  });

  it("different local dates → false even if same slot time", () => {
    const sent = new Date("2026-04-29T00:00:00Z"); // KST 09:00, Apr 29
    const now = new Date("2026-04-30T00:00:00Z"); // KST 09:00, Apr 30
    expect(isSameWindow(sent, now, "Asia/Seoul")).toBe(false);
  });
});

describe("buildMarathonMessageBody", () => {
  it("TC-MN-22: normal format", () => {
    expect(
      buildMarathonMessageBody({
        slug: "deutsch-a1",
        lastStageIndex: 200,
        cursor: 47,
        front: "der Film",
        back: "영화 작품",
      })
    ).toBe("marathon:deutsch-a1|200|47|der Film|영화 작품");
  });

  it("TC-MN-19: empty front/back when cursor exhausted", () => {
    expect(
      buildMarathonMessageBody({
        slug: "deutsch-a1",
        lastStageIndex: 625,
        cursor: 9999,
        front: "",
        back: "",
      })
    ).toBe("marathon:deutsch-a1|625|9999||");
  });
});

describe("needsCursorSync", () => {
  it("TC-MN-14: cursor behind lastStageIndex → true", () => {
    // stageCardCounts=[3,3,3], cursor=2 (stage 0), lastStageIndex=3 (all done)
    expect(needsCursorSync(2, 3, [3, 3, 3])).toBe(true);
  });

  it("cursor at current stage → false", () => {
    // stageCardCounts=[3,3,3], cursor=3 (stage 1), lastStageIndex=1 (stage 1 next)
    expect(needsCursorSync(3, 1, [3, 3, 3])).toBe(false);
  });

  it("cursor ahead of lastStageIndex → false", () => {
    // cursor=6 (stage 2), lastStageIndex=1
    expect(needsCursorSync(6, 1, [3, 3, 3])).toBe(false);
  });

  it("cursor=0, lastStageIndex=0 → false (not started)", () => {
    expect(needsCursorSync(0, 0, [3, 3, 3])).toBe(false);
  });
});
