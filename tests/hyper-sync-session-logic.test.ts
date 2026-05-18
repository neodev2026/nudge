import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  chunkArray,
  getRetryCard,
  getTtsLang,
  nextMorningAt,
  localSessionDate,
  type CardEntry,
} from "../app/features/v2/hyper-sync/lib/session-logic";

const stage: CardEntry = {
  stageId: "s1",
  targetLocale: "en",
  titleCard: { id: "t1", front: "reduce latency", back: "지연 시간을 줄이다" },
  exampleCard: {
    id: "e1",
    front: "We reduced latency by caching frequently accessed data.",
    back: "자주 접근하는 데이터를 캐싱해서 지연 시간을 줄였다.",
  },
};

const stageNoExample: CardEntry = {
  stageId: "s2",
  targetLocale: "en",
  titleCard: { id: "t2", front: "bottleneck", back: "병목 지점" },
  exampleCard: null,
};

describe("getRetryCard — 5-step pattern", () => {
  it("step 1: title forward (target → ko)", () => {
    expect(getRetryCard(stage, 1)).toEqual({
      card: { front: "reduce latency", back: "지연 시간을 줄이다" },
      isFlipped: false,
      isExample: false,
    });
  });

  it("step 2: title reversed — front becomes Korean meaning", () => {
    expect(getRetryCard(stage, 2)).toEqual({
      card: { front: "지연 시간을 줄이다", back: "reduce latency" },
      isFlipped: true,
      isExample: false,
    });
  });

  it("step 3: example forward when example exists", () => {
    expect(getRetryCard(stage, 3)).toEqual({
      card: {
        front: "We reduced latency by caching frequently accessed data.",
        back: "자주 접근하는 데이터를 캐싱해서 지연 시간을 줄였다.",
      },
      isFlipped: false,
      isExample: true,
    });
  });

  it("step 3: falls back to title forward when exampleCard is null", () => {
    expect(getRetryCard(stageNoExample, 3)).toEqual({
      card: { front: "bottleneck", back: "병목 지점" },
      isFlipped: false,
      isExample: false,
    });
  });

  it("step 4: title reversed (same orientation as step 2)", () => {
    const s2 = getRetryCard(stage, 2);
    const s4 = getRetryCard(stage, 4);
    expect(s4).toEqual(s2);
  });

  it("step 5: title forward (same orientation as step 1)", () => {
    const s1 = getRetryCard(stage, 1);
    const s5 = getRetryCard(stage, 5);
    expect(s5).toEqual(s1);
  });
});

describe("nextMorningAt", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("KST 14:00 Mon → next Tue 09:00 KST (= Tue 00:00 UTC)", () => {
    // 2026-05-18 14:00 KST = 2026-05-18 05:00 UTC
    vi.setSystemTime(new Date("2026-05-18T05:00:00Z"));
    const iso = nextMorningAt("Asia/Seoul", 9);
    // Expected: 2026-05-19 09:00 KST = 2026-05-19 00:00 UTC
    expect(iso).toBe("2026-05-19T00:00:00.000Z");
  });

  it("KST 23:30 Mon → next Tue 09:00 KST (9.5h gap)", () => {
    // 2026-05-18 23:30 KST = 2026-05-18 14:30 UTC
    vi.setSystemTime(new Date("2026-05-18T14:30:00Z"));
    const iso = nextMorningAt("Asia/Seoul", 9);
    expect(iso).toBe("2026-05-19T00:00:00.000Z");
  });

  it("KST 02:00 Tue → next Wed 09:00 KST (31h gap, not Tue!)", () => {
    // 2026-05-19 02:00 KST = 2026-05-18 17:00 UTC
    // Local "today" at this moment is 2026-05-19 → +1 day → 2026-05-20 09:00 KST
    vi.setSystemTime(new Date("2026-05-18T17:00:00Z"));
    const iso = nextMorningAt("Asia/Seoul", 9);
    expect(iso).toBe("2026-05-20T00:00:00.000Z");
  });

  it("returns a future timestamp regardless of completion hour", () => {
    // Sweep every hour of a day; every result must be > now.
    for (let h = 0; h < 24; h++) {
      const now = new Date(`2026-05-18T${String(h).padStart(2, "0")}:00:00Z`);
      vi.setSystemTime(now);
      const iso = nextMorningAt("Asia/Seoul", 9);
      expect(new Date(iso).getTime()).toBeGreaterThan(now.getTime());
    }
  });

  it("Europe/Berlin: 18:00 Mon CET → next Tue 09:00 CET", () => {
    // 2026-05-18 18:00 CEST = 2026-05-18 16:00 UTC (CEST = UTC+2 in May)
    vi.setSystemTime(new Date("2026-05-18T16:00:00Z"));
    const iso = nextMorningAt("Europe/Berlin", 9);
    // Tue 09:00 CEST = Tue 07:00 UTC
    expect(iso).toBe("2026-05-19T07:00:00.000Z");
  });
});

describe("localSessionDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("KST 23:30 → today's local date", () => {
    vi.setSystemTime(new Date("2026-05-18T14:30:00Z")); // 23:30 KST
    expect(localSessionDate("Asia/Seoul")).toBe("2026-05-18");
  });

  it("KST 02:00 next day → next day's local date", () => {
    vi.setSystemTime(new Date("2026-05-18T17:00:00Z")); // 02:00 Tue KST
    expect(localSessionDate("Asia/Seoul")).toBe("2026-05-19");
  });

  it("UTC user near midnight returns UTC date", () => {
    vi.setSystemTime(new Date("2026-05-18T23:55:00Z"));
    expect(localSessionDate("UTC")).toBe("2026-05-18");
  });
});

describe("chunkArray — multi-schedule review pagination", () => {
  it("splits exact multiple into equal chunks", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(chunkArray(items, 10)).toEqual([items]);
    expect(chunkArray(items, 5)).toEqual([
      [1, 2, 3, 4, 5],
      [6, 7, 8, 9, 10],
    ]);
  });

  it("last chunk is smaller when length not multiple of size", () => {
    expect(chunkArray([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([
      [1, 2, 3],
      [4, 5, 6],
      [7],
    ]);
  });

  it("size > length puts everything in one chunk", () => {
    expect(chunkArray([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
  });

  it("empty input returns a single empty chunk (caller's contract)", () => {
    expect(chunkArray<number>([], 10)).toEqual([[]]);
  });

  it("size <= 0 returns single chunk with all items (defensive)", () => {
    expect(chunkArray([1, 2, 3], 0)).toEqual([[1, 2, 3]]);
    expect(chunkArray([1, 2, 3], -5)).toEqual([[1, 2, 3]]);
  });

  it("preserves order across chunks", () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    const chunks = chunkArray(items, 10);
    expect(chunks.length).toBe(3);
    expect(chunks[0]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(chunks[1]).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    expect(chunks[2]).toEqual([20, 21, 22, 23, 24]);
  });
});

describe("getTtsLang — locale resolution", () => {
  it("returns target-locale BCP-47 tag when not flipped", () => {
    expect(getTtsLang("en", false)).toBe("en-US");
    expect(getTtsLang("de", false)).toBe("de-DE");
    expect(getTtsLang("ja", false)).toBe("ja-JP");
    expect(getTtsLang("es", false)).toBe("es-ES");
    expect(getTtsLang("fr", false)).toBe("fr-FR");
  });

  it("falls back to en-US for unknown locale", () => {
    expect(getTtsLang("zz", false)).toBe("en-US");
    expect(getTtsLang("", false)).toBe("en-US");
  });

  it("returns ko-KR for any flipped card (front shows Korean meaning)", () => {
    expect(getTtsLang("en", true)).toBe("ko-KR");
    expect(getTtsLang("de", true)).toBe("ko-KR");
    expect(getTtsLang("ja", true)).toBe("ko-KR");
    expect(getTtsLang("zz", true)).toBe("ko-KR");
  });
});
