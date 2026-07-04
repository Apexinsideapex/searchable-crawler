import { describe, expect, it } from "vitest";
import {
  BOT_REGISTRY,
  FULL_UA_SAMPLES,
  classifyBot,
} from "../shared/bot-registry";

describe("classifyBot", () => {
  it("classifies a full real-world GPTBot UA as OpenAI/training", () => {
    const result = classifyBot(FULL_UA_SAMPLES.GPTBot);
    expect(result).toEqual({
      name: "GPTBot",
      platform: "OpenAI",
      category: "training",
    });
  });

  it("classifies ChatGPT-User as OpenAI/conversations, not falling through to GPTBot/training", () => {
    const result = classifyBot(FULL_UA_SAMPLES["ChatGPT-User"]);
    expect(result).toEqual({
      name: "ChatGPT-User",
      platform: "OpenAI",
      category: "conversations",
    });
  });

  it("classifies OAI-SearchBot as OpenAI/indexing", () => {
    const result = classifyBot(FULL_UA_SAMPLES["OAI-SearchBot"]);
    expect(result).toEqual({
      name: "OAI-SearchBot",
      platform: "OpenAI",
      category: "indexing",
    });
  });

  it("classifies a full real-world ClaudeBot UA as Anthropic/training", () => {
    const result = classifyBot(FULL_UA_SAMPLES.ClaudeBot);
    expect(result).toEqual({
      name: "ClaudeBot",
      platform: "Anthropic",
      category: "training",
    });
  });

  it("classifies Claude-User as Anthropic/conversations, not falling through to ClaudeBot/training", () => {
    const result = classifyBot(FULL_UA_SAMPLES["Claude-User"]);
    expect(result).toEqual({
      name: "Claude-User",
      platform: "Anthropic",
      category: "conversations",
    });
  });

  it("classifies Claude-SearchBot as Anthropic/indexing", () => {
    const result = classifyBot(FULL_UA_SAMPLES["Claude-SearchBot"]);
    expect(result).toEqual({
      name: "Claude-SearchBot",
      platform: "Anthropic",
      category: "indexing",
    });
  });

  it("classifies a bare Claude-Web token as Anthropic/conversations", () => {
    const result = classifyBot(
      "Mozilla/5.0 (compatible; Claude-Web/1.0; +https://www.anthropic.com/claude-web)",
    );
    expect(result).toEqual({
      name: "Claude-Web",
      platform: "Anthropic",
      category: "conversations",
    });
  });

  it("classifies anthropic-ai token as Anthropic/training", () => {
    const result = classifyBot(
      "Mozilla/5.0 (compatible; anthropic-ai/1.0; +https://www.anthropic.com/bot)",
    );
    expect(result).toEqual({
      name: "anthropic-ai",
      platform: "Anthropic",
      category: "training",
    });
  });

  it("classifies PerplexityBot as Perplexity/indexing", () => {
    const result = classifyBot(FULL_UA_SAMPLES.PerplexityBot);
    expect(result).toEqual({
      name: "PerplexityBot",
      platform: "Perplexity",
      category: "indexing",
    });
  });

  it("classifies Perplexity-User as Perplexity/conversations", () => {
    const result = classifyBot(FULL_UA_SAMPLES["Perplexity-User"]);
    expect(result).toEqual({
      name: "Perplexity-User",
      platform: "Perplexity",
      category: "conversations",
    });
  });

  it("classifies a full real-world Googlebot UA as Google/indexing", () => {
    const result = classifyBot(FULL_UA_SAMPLES.Googlebot);
    expect(result).toEqual({
      name: "Googlebot",
      platform: "Google",
      category: "indexing",
    });
  });

  it("classifies GoogleOther as Google/training", () => {
    const result = classifyBot(FULL_UA_SAMPLES.GoogleOther);
    expect(result).toEqual({
      name: "GoogleOther",
      platform: "Google",
      category: "training",
    });
  });

  it("classifies Google-Agent as Google/agent", () => {
    const result = classifyBot(
      "Mozilla/5.0 (compatible; Google-Agent/1.0; +https://developers.google.com/search/docs/crawling-indexing/google-agent)",
    );
    expect(result).toEqual({
      name: "Google-Agent",
      platform: "Google",
      category: "agent",
    });
  });

  it("classifies Google-CloudVertexBot as Google/indexing, not falling through to Googlebot", () => {
    const result = classifyBot(
      "Mozilla/5.0 (compatible; Google-CloudVertexBot/1.0; +https://cloud.google.com/vertex-ai)",
    );
    expect(result).toEqual({
      name: "Google-CloudVertexBot",
      platform: "Google",
      category: "indexing",
    });
  });

  it("classifies a full real-world Bytespider UA as ByteDance/training", () => {
    const result = classifyBot(FULL_UA_SAMPLES.Bytespider);
    expect(result).toEqual({
      name: "Bytespider",
      platform: "ByteDance",
      category: "training",
    });
  });

  it("classifies a full real-world Amazonbot UA as Amazon/training", () => {
    const result = classifyBot(FULL_UA_SAMPLES.Amazonbot);
    expect(result).toEqual({
      name: "Amazonbot",
      platform: "Amazon",
      category: "training",
    });
  });

  it("classifies a full real-world bingbot UA as Microsoft/indexing", () => {
    const result = classifyBot(FULL_UA_SAMPLES.bingbot);
    expect(result).toEqual({
      name: "bingbot",
      platform: "Microsoft",
      category: "indexing",
    });
  });

  it("classifies Meta-ExternalFetcher as Meta/conversations, not falling through to FacebookBot/training", () => {
    const result = classifyBot(
      "Mozilla/5.0 (compatible; Meta-ExternalFetcher/1.0; +https://developers.facebook.com/docs/sharing/webmasters/crawler)",
    );
    expect(result).toEqual({
      name: "Meta-ExternalFetcher",
      platform: "Meta",
      category: "conversations",
    });
  });

  it("matches patterns as substrings anywhere in a full browser-prefixed UA (not anchored to start)", () => {
    // Real crawler UAs carry a "Mozilla/5.0 ..." prefix ahead of the
    // identifying token; the pattern must still match.
    const result = classifyBot(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 CCBot/2.0",
    );
    expect(result).toEqual({
      name: "CCBot",
      platform: "Common Crawl",
      category: "training",
    });
  });

  it("is case-insensitive", () => {
    const result = classifyBot("mozilla/5.0 (compatible; gptbot/1.0)");
    expect(result).toEqual({
      name: "GPTBot",
      platform: "OpenAI",
      category: "training",
    });
  });

  it("returns null for a plain human Chrome browser UA", () => {
    const result = classifyBot(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    );
    expect(result).toBeNull();
  });

  it("returns null for a plain human Safari mobile UA", () => {
    const result = classifyBot(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    );
    expect(result).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(classifyBot("")).toBeNull();
  });

  it("falls back to the generic Unknown bot classification for an unrecognized crawler UA", () => {
    const result = classifyBot("SomeRandomCrawler/3.1 (+https://example.com/crawler)");
    expect(result).toEqual({
      name: "Unknown bot",
      platform: "Unknown",
      category: "unknown",
    });
  });

  it("falls back to Unknown bot for UAs matching bot/spider/scrape but not any registry entry", () => {
    expect(classifyBot("MyCustomBot/1.0")).toEqual({
      name: "Unknown bot",
      platform: "Unknown",
      category: "unknown",
    });
    expect(classifyBot("SomeSpiderThing/1.0")).toEqual({
      name: "Unknown bot",
      platform: "Unknown",
      category: "unknown",
    });
    expect(classifyBot("GenericScraper/1.0")).toEqual({
      name: "Unknown bot",
      platform: "Unknown",
      category: "unknown",
    });
  });

  it("does not register Google-Extended or Applebot-Extended as robots.txt opt-out tokens are not real UAs", () => {
    const names = BOT_REGISTRY.map((entry) => entry.name.toLowerCase());
    expect(names).not.toContain("google-extended");
    expect(names).not.toContain("applebot-extended");

    // Also confirm no registry pattern matches these literal opt-out tokens
    // as a *specific* bot: "Google-Extended" contains no recognized
    // substring ("Googlebot", "GoogleOther", etc.) or generic bot/crawl/
    // spider/scrape token, so it's treated as human/unknown traffic (null),
    // never as a dedicated "Google-Extended" entry.
    expect(
      BOT_REGISTRY.some((entry) => entry.name === "Google-Extended"),
    ).toBe(false);
    expect(
      BOT_REGISTRY.some((entry) => entry.name === "Applebot-Extended"),
    ).toBe(false);
    expect(classifyBot("Google-Extended")).toBeNull();

    // "Applebot-Extended" does contain the "Applebot" substring, so per the
    // documented substring-matching behavior it's classified via the
    // Applebot entry — it is never classified as a distinct
    // "Applebot-Extended" bot, because no such registry entry exists.
    const applebotExtended = classifyBot("Applebot-Extended");
    expect(applebotExtended?.name).toBe("Applebot");
    expect(applebotExtended?.name).not.toBe("Applebot-Extended");
  });

  it("has at least 25 entries in the registry", () => {
    expect(BOT_REGISTRY.length).toBeGreaterThanOrEqual(25);
  });

  it("provides full UA samples for at least 10 bots", () => {
    expect(Object.keys(FULL_UA_SAMPLES).length).toBeGreaterThanOrEqual(10);
  });
});
