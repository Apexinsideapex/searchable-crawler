import { describe, expect, it } from "vitest";
import {
  claudeRampCount,
  dailyShapeFactor,
  hourWeight,
  mulberry32,
  weightedPick,
} from "../scripts/seed-helpers";

describe("mulberry32", () => {
  it("is deterministic for a fixed seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("produces values in [0, 1)", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("differs across seeds", () => {
    const a = mulberry32(1)();
    const b = mulberry32(2)();
    expect(a).not.toEqual(b);
  });
});

describe("weightedPick", () => {
  it("respects weight proportions over many draws", () => {
    const rng = mulberry32(123);
    const items = [
      { value: "heavy", weight: 90 },
      { value: "light", weight: 10 },
    ];
    const counts = { heavy: 0, light: 0 };
    for (let i = 0; i < 5000; i++) {
      counts[weightedPick(rng, items) as "heavy" | "light"]++;
    }
    const heavyFraction = counts.heavy / 5000;
    expect(heavyFraction).toBeGreaterThan(0.8);
    expect(heavyFraction).toBeLessThan(0.98);
  });

  it("always returns the only item when one has all the weight", () => {
    const rng = mulberry32(5);
    const items = [
      { value: "a", weight: 0 },
      { value: "b", weight: 1 },
    ];
    for (let i = 0; i < 50; i++) {
      expect(weightedPick(rng, items)).toBe("b");
    }
  });
});

describe("dailyShapeFactor", () => {
  it("dips on weekends relative to weekdays", () => {
    // 2026-07-04 is a Saturday, 2026-07-06 is a Monday (UTC).
    const saturday = new Date("2026-07-04T12:00:00Z");
    const monday = new Date("2026-07-06T12:00:00Z");
    const satFactor = dailyShapeFactor(saturday, 3, 30);
    const monFactor = dailyShapeFactor(monday, 5, 30);
    expect(satFactor).toBeLessThan(monFactor);
  });
});

describe("hourWeight", () => {
  it("stays positive across all 24 hours", () => {
    for (let h = 0; h < 24; h++) {
      expect(hourWeight(h)).toBeGreaterThan(0);
    }
  });
});

describe("claudeRampCount", () => {
  it("exactly doubles from day 0 to the final day", () => {
    const totalDays = 30;
    const day0 = claudeRampCount(0, totalDays, 20);
    const dayLast = claudeRampCount(totalDays - 1, totalDays, 20);
    expect(dayLast / day0).toBeCloseTo(2, 10);
  });
});
