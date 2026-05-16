import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  intervalDaysForRound,
} from "../app/features/v2/hyper-sync/lib/queries.server";
import {
  nextMorningInDays,
  nextMorningAt,
} from "../app/features/v2/hyper-sync/lib/session-logic";

describe("intervalDaysForRound — forgetting curve", () => {
  it("returns standard intervals 1/3/7/14 for retry_count < 3", () => {
    expect(intervalDaysForRound(1, 0)).toBe(1);
    expect(intervalDaysForRound(2, 0)).toBe(3);
    expect(intervalDaysForRound(3, 0)).toBe(7);
    expect(intervalDaysForRound(4, 0)).toBe(14);

    expect(intervalDaysForRound(1, 2)).toBe(1);
    expect(intervalDaysForRound(4, 2)).toBe(14);
  });

  it("halves intervals when retry_count >= 3 (Nudge parity)", () => {
    expect(intervalDaysForRound(2, 3)).toBe(2); // round(1.5)
    expect(intervalDaysForRound(3, 3)).toBe(4); // round(3.5)
    expect(intervalDaysForRound(4, 3)).toBe(7); // 14/2
  });

  it("box 1 halved still floors to 1 day (never same-day)", () => {
    expect(intervalDaysForRound(1, 3)).toBe(1);
    expect(intervalDaysForRound(1, 10)).toBe(1);
  });

  it("unknown round defaults to box 1 behavior", () => {
    expect(intervalDaysForRound(99 as any, 0)).toBe(1);
    expect(intervalDaysForRound(0 as any, 0)).toBe(1);
  });
});

describe("nextMorningInDays — generalized scheduled_at", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("daysAhead=1 matches nextMorningAt (backward compat)", () => {
    vi.setSystemTime(new Date("2026-05-18T05:00:00Z")); // 14:00 KST Mon
    const a = nextMorningInDays("Asia/Seoul", 9, 1);
    const b = nextMorningAt("Asia/Seoul", 9);
    expect(a).toBe(b);
  });

  it("daysAhead=3 → Thu 09:00 KST (= Wed 00:00 UTC) from Mon afternoon", () => {
    vi.setSystemTime(new Date("2026-05-18T05:00:00Z")); // 14:00 Mon KST
    const iso = nextMorningInDays("Asia/Seoul", 9, 3);
    // Mon + 3 days = Thu 09:00 KST = Thu 00:00 UTC
    expect(iso).toBe("2026-05-21T00:00:00.000Z");
  });

  it("daysAhead=7 from Mon afternoon → next Mon 09:00 KST", () => {
    vi.setSystemTime(new Date("2026-05-18T05:00:00Z"));
    const iso = nextMorningInDays("Asia/Seoul", 9, 7);
    expect(iso).toBe("2026-05-25T00:00:00.000Z");
  });

  it("daysAhead=14 from Mon afternoon → 2 Mondays later 09:00 KST", () => {
    vi.setSystemTime(new Date("2026-05-18T05:00:00Z"));
    const iso = nextMorningInDays("Asia/Seoul", 9, 14);
    expect(iso).toBe("2026-06-01T00:00:00.000Z");
  });

  it("daysAhead < 1 is floored to 1 (no same-day dispatch)", () => {
    vi.setSystemTime(new Date("2026-05-18T05:00:00Z"));
    const next_day = nextMorningInDays("Asia/Seoul", 9, 1);
    expect(nextMorningInDays("Asia/Seoul", 9, 0)).toBe(next_day);
    expect(nextMorningInDays("Asia/Seoul", 9, -5)).toBe(next_day);
  });

  it("returns a future timestamp regardless of completion hour and interval", () => {
    for (const h of [0, 5, 12, 19, 23]) {
      for (const days of [1, 3, 7, 14]) {
        const now = new Date(`2026-05-18T${String(h).padStart(2, "0")}:00:00Z`);
        vi.setSystemTime(now);
        const iso = nextMorningInDays("Asia/Seoul", 9, days);
        expect(new Date(iso).getTime()).toBeGreaterThan(now.getTime());
      }
    }
  });
});
