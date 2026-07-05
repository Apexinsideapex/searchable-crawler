/**
 * scripts/simulate.ts
 *
 * Phase 3 live traffic simulator. Unlike scripts/seed.ts (which bulk-writes
 * ~30 days of history directly to Postgres, bypassing ingestion entirely),
 * this script proves the REAL ingestion pipeline end-to-end during a live
 * demo: it fires real HTTP POST requests at the deployed `ingest` Supabase
 * Edge Function at a human-watchable rate, so the audience can watch the
 * realtime feed and hero stats move on screen.
 *
 * Usage:
 *   npm run simulate -- --site <uuid> [--rate 2] [--live]
 *
 * Runs until Ctrl-C (SIGINT), printing one line per event sent, then prints
 * a final summary (total events sent) before exiting.
 *
 * `--live` is accepted for parity with the phase-plan's documented usage
 * (`simulate.ts --live`) but is a no-op flag here — there is no other
 * described mode, so the script's actual behavior is simply: run
 * continuously at `--rate` events/sec until Ctrl-C, regardless of whether
 * `--live` is passed.
 */

import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FULL_UA_SAMPLES } from "../shared/bot-registry";
import { weightedPick, type Weighted } from "./seed-helpers";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
config({ path: join(repoRoot, ".env.local") });

const DEMO_DOMAIN = "demo.aicrawler-analytics.example";
const REQUEST_TIMEOUT_MS = 5000;

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

interface Args {
  site: string;
  rate: number;
  live: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { site: "", rate: 2, live: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--site") args.site = argv[++i];
    else if (arg === "--rate") args.rate = Number(argv[++i]);
    else if (arg === "--live") args.live = true;
  }
  if (!args.site) {
    console.error("Usage: simulate.ts --site <uuid> [--rate 2] [--live]");
    process.exit(1);
  }
  if (!Number.isFinite(args.rate) || args.rate <= 0) {
    console.error("--rate must be a positive number (events/sec)");
    process.exit(1);
  }
  return args;
}

// ---------------------------------------------------------------------------
// Weighted picks — a smaller, similarly-weighted local mirror of seed.ts's
// PAGES / bot tables. seed.ts doesn't export its tables (they're tuned for
// its 30-day story arc), so this is a deliberately scoped-down local list
// rather than a refactor of the sibling script.
// ---------------------------------------------------------------------------

const PAGES: Weighted<string>[] = [
  { value: "/", weight: 20 },
  { value: "/pricing", weight: 15 },
  { value: "/blog/ai-visibility-guide", weight: 10 },
  { value: "/blog/how-crawlers-index-your-site", weight: 4 },
  { value: "/docs/getting-started", weight: 3 },
  { value: "/docs/api-reference", weight: 2 },
  { value: "/docs/old-api", weight: 1.2 },
  { value: "/about", weight: 2 },
  { value: "/changelog", weight: 2 },
  { value: "/features", weight: 1.5 },
];

const BOTS: Weighted<string>[] = [
  { value: "GPTBot", weight: 22 },
  { value: "ClaudeBot", weight: 14 },
  { value: "Googlebot", weight: 12 },
  { value: "GoogleOther", weight: 6 },
  { value: "FacebookBot", weight: 9 },
  { value: "bingbot", weight: 7 },
  { value: "PerplexityBot", weight: 5 },
  { value: "Amazonbot", weight: 6 },
  { value: "Applebot", weight: 3 },
  { value: "OAI-SearchBot", weight: 3 },
  { value: "Claude-SearchBot", weight: 2 },
  { value: "ChatGPT-User", weight: 5 },
  { value: "Claude-User", weight: 4 },
  { value: "Perplexity-User", weight: 3 },
  { value: "Bytespider", weight: 4 },
  { value: "CCBot", weight: 2 },
];

function uaFor(botName: string): string {
  const ua = FULL_UA_SAMPLES[botName];
  if (!ua) throw new Error(`No FULL_UA_SAMPLES entry for ${botName}`);
  return ua;
}

/** Real (non-seeded) weighted pick — determinism doesn't matter for a live
 * demo script, so plain Math.random() is fine here. */
function pick<T>(items: Weighted<T>[]): T {
  return weightedPick(Math.random, items);
}

// ---------------------------------------------------------------------------
// Ingest endpoint — derived from NEXT_PUBLIC_SUPABASE_URL the same way the
// rest of the codebase points at Supabase (see lib/supabase/*.ts), matching
// the `<SUPABASE_URL>/functions/v1/ingest` shape documented in README.md /
// shared/track-crawlers.ts.
// ---------------------------------------------------------------------------

export function ingestUrl(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/ingest`;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} (check .env.local)`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Event send
// ---------------------------------------------------------------------------

interface SimEvent {
  botName: string;
  platform: string;
  path: string;
}

const BOT_PLATFORM: Record<string, string> = {
  GPTBot: "OpenAI",
  "ChatGPT-User": "OpenAI",
  "OAI-SearchBot": "OpenAI",
  ClaudeBot: "Anthropic",
  "Claude-User": "Anthropic",
  "Claude-SearchBot": "Anthropic",
  PerplexityBot: "Perplexity",
  "Perplexity-User": "Perplexity",
  Googlebot: "Google",
  GoogleOther: "Google",
  FacebookBot: "Meta",
  Applebot: "Apple",
  Amazonbot: "Amazon",
  Bytespider: "ByteDance",
  CCBot: "Common Crawl",
  bingbot: "Microsoft",
};

function pickEvent(): SimEvent {
  const botName = pick(BOTS);
  const path = pick(PAGES);
  return { botName, platform: BOT_PLATFORM[botName] ?? "Unknown", path };
}

async function sendEvent(endpoint: string, siteId: string, event: SimEvent): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        site_id: siteId,
        page_url: `https://${DEMO_DOMAIN}${event.path}`,
        user_agent: uaFor(event.botName),
        method: "GET",
        source: "simulator",
        is_verification: false,
      }),
    });
    if (!res.ok) {
      console.error(`  ! ingest responded ${res.status} for ${event.botName} ${event.path}`);
    }
  } catch (err) {
    console.error(`  ! request failed for ${event.botName} ${event.path}:`, (err as Error).message);
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const endpoint = ingestUrl(supabaseUrl);

  console.log(`Simulating live traffic for site ${args.site}`);
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Rate: ${args.rate} events/sec. Press Ctrl-C to stop.\n`);

  let total = 0;
  let stopping = false;
  const intervalMs = 1000 / args.rate;

  const timer = setInterval(() => {
    if (stopping) return;
    const event = pickEvent();
    total++;
    const ts = new Date().toISOString().split("T")[1].replace("Z", "");
    console.log(
      `[${ts}] #${total} ${event.botName.padEnd(18)} ${event.platform.padEnd(12)} ${event.path}`,
    );
    void sendEvent(endpoint, args.site, event);
  }, intervalMs);

  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    clearInterval(timer);
    console.log(`\nStopped. Sent ${total} event${total === 1 ? "" : "s"}.`);
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
