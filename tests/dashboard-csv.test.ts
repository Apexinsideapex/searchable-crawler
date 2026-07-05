import { describe, expect, it } from "vitest";
import { buildCsv, csvFilename } from "../lib/dashboard/csv";
import type { CrawlerEventRow } from "../lib/dashboard/csv";

function row(overrides: Partial<CrawlerEventRow> = {}): CrawlerEventRow {
  return {
    occurred_at: "2026-07-05T12:00:00.000Z",
    page_url: "https://example.com/pricing",
    bot_name: "GPTBot",
    platform: "OpenAI",
    bot_category: "training",
    status_code: 200,
    source: "server",
    user_agent: "GPTBot/1.0",
    ...overrides,
  };
}

describe("buildCsv", () => {
  it("emits the exact header row in the specified column order", () => {
    const csv = buildCsv([]);
    const [header] = csv.split("\r\n");
    expect(header).toBe(
      "occurred_at,page_url,bot_name,platform,bot_category,status_code,source,user_agent",
    );
  });

  it("emits one data row per event with plain values unquoted", () => {
    const csv = buildCsv([row()]);
    const lines = csv.split("\r\n");
    expect(lines[1]).toBe(
      "2026-07-05T12:00:00.000Z,https://example.com/pricing,GPTBot,OpenAI,training,200,server,GPTBot/1.0",
    );
  });

  it("quotes and escapes a user_agent field containing commas", () => {
    const csv = buildCsv([
      row({ user_agent: "Mozilla/5.0, compatible; GPTBot/1.0" }),
    ]);
    const lines = csv.split("\r\n");
    expect(lines[1]).toContain('"Mozilla/5.0, compatible; GPTBot/1.0"');
  });

  it("doubles internal double-quote characters and wraps the field in quotes", () => {
    const csv = buildCsv([row({ user_agent: 'Bot "the crawler" 1.0' })]);
    const lines = csv.split("\r\n");
    expect(lines[1]).toContain('"Bot ""the crawler"" 1.0"');
  });

  it("quotes a field containing a newline", () => {
    const csv = buildCsv([row({ page_url: "https://example.com/a\nb" })]);
    const lines = csv.split("\r\n");
    expect(lines[1]).toContain('"https://example.com/a\nb"');
  });

  it("renders a null status_code as an empty field", () => {
    const csv = buildCsv([row({ status_code: null })]);
    const lines = csv.split("\r\n");
    expect(lines[1]).toBe(
      "2026-07-05T12:00:00.000Z,https://example.com/pricing,GPTBot,OpenAI,training,,server,GPTBot/1.0",
    );
  });
});

describe("csvFilename", () => {
  it("builds the filename from domain and range per the spec", () => {
    expect(csvFilename("example.com", "7d")).toBe(
      "crawler-events-example.com-7d.csv",
    );
  });
});
