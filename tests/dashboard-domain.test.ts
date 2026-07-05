import { describe, expect, it } from "vitest";
import { normalizeDomain } from "../lib/dashboard/domain";

describe("normalizeDomain", () => {
  it("accepts a bare domain unchanged", () => {
    expect(normalizeDomain("example.com")).toBe("example.com");
  });

  it("strips a leading https:// scheme", () => {
    expect(normalizeDomain("https://example.com")).toBe("example.com");
  });

  it("strips a leading http:// scheme", () => {
    expect(normalizeDomain("http://example.com")).toBe("example.com");
  });

  it("strips a trailing path", () => {
    expect(normalizeDomain("example.com/blog/post")).toBe("example.com");
  });

  it("strips a trailing slash with no path", () => {
    expect(normalizeDomain("example.com/")).toBe("example.com");
  });

  it("strips a leading www.", () => {
    expect(normalizeDomain("www.example.com")).toBe("example.com");
  });

  it("lowercases mixed-case input", () => {
    expect(normalizeDomain("Example.COM")).toBe("example.com");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeDomain("  example.com  ")).toBe("example.com");
  });

  it("preserves a subdomain that is not www", () => {
    expect(normalizeDomain("blog.example.com")).toBe("blog.example.com");
  });

  it("preserves a port", () => {
    expect(normalizeDomain("localhost:3000")).toBe("localhost:3000");
  });

  it("rejects empty input", () => {
    expect(normalizeDomain("")).toBeNull();
  });

  it("rejects whitespace-only input", () => {
    expect(normalizeDomain("   ")).toBeNull();
  });

  it("rejects a string with no dot and no known host like 'localhost'", () => {
    expect(normalizeDomain("not a domain")).toBeNull();
  });

  it("rejects a string containing spaces even with a dot", () => {
    expect(normalizeDomain("example .com")).toBeNull();
  });

  it("accepts bare localhost", () => {
    expect(normalizeDomain("localhost")).toBe("localhost");
  });
});
