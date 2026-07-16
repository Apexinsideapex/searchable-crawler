/**
 * shared/bot-registry.ts
 *
 * Pure data + pure functions, zero dependencies. Importable by both Deno
 * (Supabase Edge Functions, via the synced copy in
 * supabase/functions/_shared/bot-registry.ts) and Node/Edge (Next.js
 * middleware, demo-data seeder).
 *
 * DO NOT hand-edit supabase/functions/_shared/bot-registry.ts — it is a
 * generated copy of this file. Run `npm run sync:shared` after editing this
 * file, and `npm run check:shared` (or `npm run build`) will fail the build
 * if the two files drift apart.
 */

export type BotCategory =
  | "training"
  | "indexing"
  | "conversations"
  | "agent"
  | "unknown";

export interface BotDef {
  pattern: RegExp;
  name: string;
  platform: string;
  category: BotCategory;
}

/**
 * Registry of known AI/search crawler user-agent substrings.
 *
 * Order matters: most-specific-first. For example, `ChatGPT-User` and
 * `OAI-SearchBot` are listed before `GPTBot` so that OpenAI's conversational
 * and search-fetch bots aren't misclassified as the generic training
 * crawler. Similarly, `Claude-SearchBot`, `Claude-User`, and `Claude-Web`
 * precede `ClaudeBot`.
 *
 * Deliberate omission: `Google-Extended` and `Applebot-Extended` are
 * robots.txt opt-out tokens, not real User-Agent strings — they never
 * appear on the wire, so they have no entry here. See
 * 00-MASTER-PLAN.md §2 for the rationale.
 */
export const BOT_REGISTRY: BotDef[] = [
  { pattern: /ChatGPT-User/i, name: "ChatGPT-User", platform: "OpenAI", category: "conversations" },
  { pattern: /OAI-SearchBot/i, name: "OAI-SearchBot", platform: "OpenAI", category: "indexing" },
  { pattern: /GPTBot/i, name: "GPTBot", platform: "OpenAI", category: "training" },

  { pattern: /Claude-SearchBot/i, name: "Claude-SearchBot", platform: "Anthropic", category: "indexing" },
  { pattern: /Claude-User/i, name: "Claude-User", platform: "Anthropic", category: "conversations" },
  { pattern: /Claude-Web/i, name: "Claude-Web", platform: "Anthropic", category: "conversations" },
  { pattern: /ClaudeBot/i, name: "ClaudeBot", platform: "Anthropic", category: "training" },
  { pattern: /anthropic-ai/i, name: "anthropic-ai", platform: "Anthropic", category: "training" },

  { pattern: /Perplexity-User/i, name: "Perplexity-User", platform: "Perplexity", category: "conversations" },
  { pattern: /PerplexityBot/i, name: "PerplexityBot", platform: "Perplexity", category: "indexing" },

  { pattern: /Google-CloudVertexBot/i, name: "Google-CloudVertexBot", platform: "Google", category: "indexing" },
  { pattern: /Google-Agent/i, name: "Google-Agent", platform: "Google", category: "agent" },
  { pattern: /GoogleOther/i, name: "GoogleOther", platform: "Google", category: "training" },
  { pattern: /Googlebot/i, name: "Googlebot", platform: "Google", category: "indexing" },
  // Gemini's live in-chat browsing sends a bare `User-Agent: Google` (no
  // other tokens) — confirmed via a live capture against a debug endpoint
  // (handoffs/TRACKER.md, 2026-07-05). Anchored to the full string so this
  // doesn't swallow any other Google UA that merely contains the word
  // "Google" as a substring; placed after the more specific Google-* entries
  // above since they'd never overlap with an exact-match pattern anyway.
  { pattern: /^Google$/i, name: "Gemini", platform: "Google", category: "agent" },

  { pattern: /MistralAI-User/i, name: "MistralAI-User", platform: "Mistral", category: "conversations" },

  { pattern: /Meta-ExternalFetcher/i, name: "Meta-ExternalFetcher", platform: "Meta", category: "conversations" },
  { pattern: /Meta-ExternalAgent/i, name: "Meta-ExternalAgent", platform: "Meta", category: "training" },
  { pattern: /FacebookBot/i, name: "FacebookBot", platform: "Meta", category: "training" },

  { pattern: /Applebot/i, name: "Applebot", platform: "Apple", category: "indexing" },

  { pattern: /Amazonbot/i, name: "Amazonbot", platform: "Amazon", category: "training" },

  { pattern: /Bytespider/i, name: "Bytespider", platform: "ByteDance", category: "training" },

  { pattern: /CCBot/i, name: "CCBot", platform: "Common Crawl", category: "training" },

  { pattern: /DeepSeekBot/i, name: "DeepSeekBot", platform: "DeepSeek", category: "training" },

  // xAI documents GrokBot (training), xAI-Grok (user-triggered fetch) and
  // Grok-DeepSearch (agentic research). Note: Grok's retrieval traffic is
  // widely reported to ALSO use spoofed browser UAs, which no UA-based
  // classifier can attribute — these patterns only catch the honest ones.
  { pattern: /GrokBot/i, name: "GrokBot", platform: "xAI", category: "training" },
  { pattern: /xAI-Grok/i, name: "xAI-Grok", platform: "xAI", category: "conversations" },
  { pattern: /Grok-DeepSearch/i, name: "Grok-DeepSearch", platform: "xAI", category: "agent" },

  { pattern: /DuckAssistBot/i, name: "DuckAssistBot", platform: "DuckDuckGo", category: "indexing" },

  { pattern: /YouBot/i, name: "YouBot", platform: "You.com", category: "indexing" },

  { pattern: /cohere-ai/i, name: "cohere-ai", platform: "Cohere", category: "training" },

  { pattern: /AI2Bot/i, name: "AI2Bot", platform: "Allen AI", category: "training" },

  { pattern: /bingbot/i, name: "bingbot", platform: "Microsoft", category: "indexing" },
];

/** Generic fallback pattern for crawlers not in the registry above. */
const GENERIC_BOT_PATTERN = /bot|crawl|spider|scrape/i;

/**
 * AI-vendor tokens mirroring the middleware pre-filter regex (see
 * shared/track-crawlers.ts / the Settings middleware snippet). A UA carrying
 * one of these tokens but matching no registry entry is almost certainly a
 * new or renamed AI fetcher (vendors keep shipping "-User"/"-Agent"/
 * "DeepSearch"-style names without "bot" in them) — surface it as
 * "Unknown bot" so it shows up in the dashboard and can be added to the
 * registry, instead of being silently dropped as human traffic.
 *
 * Deliberate differences from the middleware regex:
 * - "meta-" is hyphenated: bare "meta" appears in human UAs (Meta Quest
 *   browsers), and this pattern also classifies pixel traffic where every
 *   human browser UA flows through.
 * - "xai" is included for future xAI fetcher names beyond Grok.
 */
const AI_TOKEN_PATTERN =
  /chatgpt|gpt|claude|anthropic|perplexity|oai|google|gemini|meta-|facebook|mistral|deepseek|grok|xai|duckassist|you\.com|cohere|ai2/i;

/**
 * Real-world, full User-Agent strings keyed by bot name. Used by the
 * demo-data seeder/simulator to generate plausible traffic.
 */
export const FULL_UA_SAMPLES: Record<string, string> = {
  GPTBot:
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.0; +https://openai.com/gptbot)",
  "ChatGPT-User":
    "Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)",
  "OAI-SearchBot":
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)",
  ClaudeBot:
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
  "Claude-User":
    "Mozilla/5.0 (compatible; Claude-User/1.0; +https://www.anthropic.com/claude-user)",
  "Claude-SearchBot":
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-SearchBot/1.0; +https://www.anthropic.com/claude-searchbot)",
  PerplexityBot:
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
  "Perplexity-User":
    "Mozilla/5.0 (compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)",
  Googlebot:
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  GoogleOther:
    "Mozilla/5.0 (compatible; GoogleOther)",
  Bytespider:
    "Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)",
  Amazonbot:
    "Mozilla/5.0 (compatible; Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot)",
  bingbot:
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  CCBot:
    "CCBot/2.0 (https://commoncrawl.org/faq/)",
  Applebot:
    "Mozilla/5.0 (Applebot/0.1; +http://www.apple.com/go/applebot)",
  FacebookBot:
    "Mozilla/5.0 (compatible; FacebookBot/1.0; +https://developers.facebook.com/docs/sharing/webmasters/crawler)",
  DeepSeekBot:
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; DeepSeekBot/1.0; +https://deepseek.com/deepseekbot)",
};

/**
 * Classify a User-Agent string as a known AI/search crawler.
 *
 * - Patterns are matched as case-insensitive substrings anywhere in the UA
 *   (never anchored to the start), since real UAs carry a `Mozilla/5.0`
 *   prefix ahead of the identifying token.
 * - Registry entries are checked in order (most-specific-first); the first
 *   match wins.
 * - UAs that don't match a specific entry but look like a crawler (matching
 *   /bot|crawl|spider|scrape/i) or carry an AI-vendor token (AI_TOKEN_PATTERN)
 *   fall back to a generic "Unknown bot" result.
 * - Anything else (human/browser traffic) returns `null`.
 */
export function classifyBot(
  ua: string,
): { name: string; platform: string; category: BotCategory } | null {
  if (!ua) return null;

  for (const entry of BOT_REGISTRY) {
    if (entry.pattern.test(ua)) {
      return { name: entry.name, platform: entry.platform, category: entry.category };
    }
  }

  if (GENERIC_BOT_PATTERN.test(ua) || AI_TOKEN_PATTERN.test(ua)) {
    return { name: "Unknown bot", platform: "Unknown", category: "unknown" };
  }

  return null;
}
