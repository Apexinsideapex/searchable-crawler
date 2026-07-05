import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "../lib/dashboard/format";

describe("formatRelativeTime", () => {
  it("returns 'just now' for timestamps under a minute old", () => {
    expect(formatRelativeTime(new Date(Date.now() - 10_000).toISOString())).toBe(
      "just now",
    );
  });

  it("formats minutes for timestamps under an hour old", () => {
    expect(
      formatRelativeTime(new Date(Date.now() - 5 * 60_000).toISOString()),
    ).toBe("5m ago");
  });

  it("formats hours for timestamps under a day old", () => {
    expect(
      formatRelativeTime(new Date(Date.now() - 3 * 60 * 60_000).toISOString()),
    ).toBe("3h ago");
  });

  it("formats days for timestamps a day or more old", () => {
    expect(
      formatRelativeTime(new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString()),
    ).toBe("2d ago");
  });
});
