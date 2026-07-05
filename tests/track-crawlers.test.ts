import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trackAiCrawlers } from "../shared/track-crawlers";

const CFG = {
  siteId: "test-site-id",
  endpoint: "https://example.test/ingest",
};

function makeRequest(userAgent: string, url = "https://customer.example/page") {
  return new Request(url, { headers: { "user-agent": userAgent } });
}

describe("trackAiCrawlers", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("no-ops for a human UA (regex doesn't match)", () => {
    const req = makeRequest(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    );
    trackAiCrawlers(req, CFG);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fires for a bot UA (regex matches)", () => {
    const req = makeRequest("GPTBot/1.0 (+https://openai.com/gptbot)");
    trackAiCrawlers(req, CFG);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      CFG.endpoint,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({
      site_id: CFG.siteId,
      page_url: req.url,
      user_agent: "GPTBot/1.0 (+https://openai.com/gptbot)",
      method: "GET",
      source: "server",
    });
  });

  it("matches other known crawler-ish UAs (ClaudeBot, PerplexityBot, generic crawler/spider/scrape)", () => {
    const uas = [
      "ClaudeBot/1.0",
      "PerplexityBot/1.0",
      "Some-Random-Crawler/1.0",
      "GenericSpider/1.0",
      "scrape-tool/1.0",
    ];
    for (const ua of uas) {
      fetchMock.mockClear();
      trackAiCrawlers(makeRequest(ua), CFG);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  });

  it("is genuinely fire-and-forget: returns before the fetch promise settles", async () => {
    let resolveFetch!: (value: Response) => void;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const order: string[] = [];
    const req = makeRequest("GPTBot/1.0");

    const result = trackAiCrawlers(req, CFG);
    order.push("after-call");
    expect(result).toBeUndefined(); // not a Promise — nothing to await

    // The fetch hasn't resolved yet, proving trackAiCrawlers didn't await it.
    resolveFetch(new Response(null, { status: 204 }));
    await Promise.resolve();
    order.push("after-fetch-resolved");

    expect(order).toEqual(["after-call", "after-fetch-resolved"]);
  });

  it("swallows fetch rejections instead of throwing or producing an unhandled rejection", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const req = makeRequest("GPTBot/1.0");
    expect(() => trackAiCrawlers(req, CFG)).not.toThrow();
    // Give the microtask queue a turn to process the rejection's .catch()
    await new Promise((r) => setTimeout(r, 0));
  });
});
