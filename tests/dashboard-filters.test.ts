import { describe, expect, it } from "vitest";
import {
  computeDelta,
  parseFilters,
  resolveDateWindow,
  serializeFilters,
} from "../lib/dashboard/filters";

describe("resolveDateWindow", () => {
  const now = new Date("2026-07-05T12:00:00.000Z");

  it("24h: current window is the trailing 24 hours, bucketed hourly", () => {
    const w = resolveDateWindow("24h", now);
    expect(w.to.toISOString()).toBe("2026-07-05T12:00:00.000Z");
    expect(w.from.toISOString()).toBe("2026-07-04T12:00:00.000Z");
    expect(w.bucket).toBe("1 hour");
  });

  it("24h: previous window is the equal-length 24h immediately before, non-overlapping", () => {
    const w = resolveDateWindow("24h", now);
    expect(w.prevTo.toISOString()).toBe(w.from.toISOString());
    expect(w.prevFrom.toISOString()).toBe("2026-07-03T12:00:00.000Z");
    expect(w.prevTo.getTime() - w.prevFrom.getTime()).toBe(
      w.to.getTime() - w.from.getTime(),
    );
  });

  it("7d: current window is the trailing 7 days, bucketed daily", () => {
    const w = resolveDateWindow("7d", now);
    expect(w.to.toISOString()).toBe("2026-07-05T12:00:00.000Z");
    expect(w.from.toISOString()).toBe("2026-06-28T12:00:00.000Z");
    expect(w.bucket).toBe("1 day");
  });

  it("7d: previous window is the equal-length 7d immediately before", () => {
    const w = resolveDateWindow("7d", now);
    expect(w.prevTo.toISOString()).toBe(w.from.toISOString());
    expect(w.prevFrom.toISOString()).toBe("2026-06-21T12:00:00.000Z");
  });

  it("30d: current and previous windows are equal-length 30-day spans, bucketed daily", () => {
    const w = resolveDateWindow("30d", now);
    expect(w.to.toISOString()).toBe("2026-07-05T12:00:00.000Z");
    expect(w.from.toISOString()).toBe("2026-06-05T12:00:00.000Z");
    expect(w.bucket).toBe("1 day");
    expect(w.prevTo.toISOString()).toBe(w.from.toISOString());
    expect(w.prevFrom.toISOString()).toBe("2026-05-06T12:00:00.000Z");
    expect(w.prevTo.getTime() - w.prevFrom.getTime()).toBe(
      w.to.getTime() - w.from.getTime(),
    );
  });

  it("defaults `now` to the current time when omitted", () => {
    const before = Date.now();
    const w = resolveDateWindow("24h");
    const after = Date.now();
    expect(w.to.getTime()).toBeGreaterThanOrEqual(before);
    expect(w.to.getTime()).toBeLessThanOrEqual(after);
  });
});

describe("computeDelta", () => {
  it("computes a positive percent delta", () => {
    expect(computeDelta(150, 100)).toBe(50);
  });

  it("computes a negative percent delta", () => {
    expect(computeDelta(50, 100)).toBe(-50);
  });

  it("returns 0 when both current and previous are 0 (no change)", () => {
    expect(computeDelta(0, 0)).toBe(0);
  });

  it("returns null when previous is 0 but current is positive (no baseline to compare against)", () => {
    expect(computeDelta(10, 0)).toBeNull();
  });
});

describe("parseFilters", () => {
  it("defaults to range=7d, category=all, platforms=null when nothing is provided", () => {
    const filters = parseFilters(new URLSearchParams());
    expect(filters).toEqual({ range: "7d", category: "all", platforms: null });
  });

  it("parses explicit range, category, and comma-separated platforms", () => {
    const filters = parseFilters(
      new URLSearchParams("range=24h&category=training&platforms=OpenAI,Anthropic"),
    );
    expect(filters).toEqual({
      range: "24h",
      category: "training",
      platforms: ["OpenAI", "Anthropic"],
    });
  });

  it("falls back to defaults for invalid/unrecognized values instead of throwing", () => {
    const filters = parseFilters(
      new URLSearchParams("range=nonsense&category=nonsense"),
    );
    expect(filters).toEqual({ range: "7d", category: "all", platforms: null });
  });
});

describe("serializeFilters", () => {
  it("round-trips through parseFilters", () => {
    const original = {
      range: "30d" as const,
      category: "conversations" as const,
      platforms: ["OpenAI", "Anthropic"],
    };
    const params = serializeFilters(original);
    expect(parseFilters(params)).toEqual(original);
  });

  it("omits the platforms param entirely when platforms is null", () => {
    const params = serializeFilters({
      range: "7d",
      category: "all",
      platforms: null,
    });
    expect(params.has("platforms")).toBe(false);
  });
});
