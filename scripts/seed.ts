/**
 * scripts/seed.ts
 *
 * Phase 3 demo-data seeder. Writes ~30 days of realistic, deterministic
 * fake AI-crawler traffic directly into `crawler_events` for a given
 * `sites.id`, bypassing the `ingest` Edge Function entirely (this is a bulk
 * direct-DB write, not a simulation of real HTTP traffic — see
 * scripts/simulate.ts for that).
 *
 * A fixed PRNG seed + a fixed "now" anchor derived only from CLI args means
 * `npm run seed:reset` produces byte-identical aggregate distributions
 * (same daily counts, same story-arc shape) on every rerun. The only thing
 * that's NOT identical between runs is wall-clock insert time — the actual
 * `occurred_at` values are computed relative to the `--days` window ending
 * at UTC midnight of the day the script runs, not `Date.now()`, so reruns
 * on the same calendar day are exactly identical, and reruns on a later day
 * shift the whole window forward by that many days (still deterministic).
 *
 * Story arc planted for Phase 5's LLM brief to "discover":
 *   1. ClaudeBot volume doubles linearly from day 1 to day 30.
 *   2. Conversations (ChatGPT-User + Claude-User + Perplexity-User) hits on
 *      /pricing and /blog/ai-visibility-guide grow week over week.
 *   3. DeepSeekBot appears for the first time only in the last 3 days.
 *   4. /docs/old-api 404s to every single crawler hit, all month.
 *   5. Bytespider spikes 5x its normal daily baseline on day 25.
 *
 * Usage:
 *   npm run seed -- --site <uuid> [--days 30] [--events 10000] [--reset]
 *   npm run seed:reset -- --site <uuid>
 */

import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import { classifyBot, FULL_UA_SAMPLES } from "../shared/bot-registry";
import {
  claudeRampCount,
  dailyShapeFactor,
  hourWeight,
  mulberry32,
  weightedPick,
  type Weighted,
} from "./seed-helpers";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
config({ path: join(repoRoot, ".env.local") });

// Fixed seed (NOT Date.now()) — this is what makes reruns deterministic.
const RNG_SEED = 0xc0ffee42;
const DEMO_DOMAIN = "demo.aicrawler-analytics.example";
const BATCH_SIZE = 500;

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]) {
  const args = { site: "", days: 30, events: 10000, reset: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--site") args.site = argv[++i];
    else if (arg === "--days") args.days = Number(argv[++i]);
    else if (arg === "--events") args.events = Number(argv[++i]);
    else if (arg === "--reset") args.reset = true;
  }
  if (!args.site) {
    console.error("Usage: seed.ts --site <uuid> [--days 30] [--events 10000] [--reset]");
    process.exit(1);
  }
  return args;
}

// ---------------------------------------------------------------------------
// Pages (power-law popularity, top 3 ~= 45% of traffic)
// ---------------------------------------------------------------------------

const PAGES: Weighted<string>[] = [
  { value: "/", weight: 20 },
  { value: "/pricing", weight: 15 },
  { value: "/blog/ai-visibility-guide", weight: 10 }, // top 3 = 45
  { value: "/blog/how-crawlers-index-your-site", weight: 4 },
  { value: "/blog/llm-answer-engines-2026", weight: 3.5 },
  { value: "/blog/robots-txt-for-ai-bots", weight: 3 },
  { value: "/blog/measuring-ai-referral-traffic", weight: 2.5 },
  { value: "/blog/gptbot-vs-googlebot", weight: 2 },
  { value: "/blog/why-your-docs-need-structured-data", weight: 1.5 },
  { value: "/blog/case-study-visibility-lift", weight: 1 },
  { value: "/docs/getting-started", weight: 3 },
  { value: "/docs/quickstart", weight: 2.5 },
  { value: "/docs/authentication", weight: 2 },
  { value: "/docs/api-reference", weight: 2 },
  { value: "/docs/webhooks", weight: 1.5 },
  { value: "/docs/rate-limits", weight: 1.5 },
  { value: "/docs/sdks", weight: 1 },
  { value: "/docs/self-hosting", weight: 1 },
  { value: "/docs/migrating-from-v1", weight: 1 },
  { value: "/docs/faq", weight: 1 },
  { value: "/docs/old-api", weight: 1.2 }, // the story-arc 404 page
  { value: "/about", weight: 2 },
  { value: "/changelog", weight: 2 },
  { value: "/features", weight: 1.5 },
  { value: "/security", weight: 1.3 },
];

const OLD_API_PATH = "/docs/old-api";
const PRICING_PATH = "/pricing";
const AI_VISIBILITY_PATH = "/blog/ai-visibility-guide";

// Pages eligible for "regular" (non-conversational) traffic exclude nothing —
// every bot can, in principle, hit any page, incl. the 404 trap.
const REGULAR_PAGE_WEIGHTS = PAGES;

// For the 3 conversational bots, the story arc requires the /pricing +
// /blog/ai-visibility-guide share of THEIR traffic to grow week over week.
// Everything else they hit is drawn from a flatter page mix (still
// including the two story pages at their normal baseline weight) so the
// "other" pool doesn't itself skew the growth signal.
const CONVO_OTHER_PAGES: Weighted<string>[] = PAGES.filter(
  (p) => p.value !== PRICING_PATH && p.value !== AI_VISIBILITY_PATH,
);
// Combined share of a conversational bot's traffic landing on the two story
// pages, indexed by week-of-month (0-based). Strictly increasing.
const CONVO_STORY_SHARE_BY_WEEK = [0.15, 0.25, 0.35, 0.48, 0.6];

// ---------------------------------------------------------------------------
// Bots — baseline weights for a "typical" day. ClaudeBot, Bytespider, CCBot
// and DeepSeekBot are all handled specially per-day below; their entries
// here are the *baseline* used to derive that day-specific behavior.
// ---------------------------------------------------------------------------

const REGULAR_BOTS: Weighted<string>[] = [
  { value: "GPTBot", weight: 22 },
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
  { value: "__unknown__", weight: 3 }, // synthetic generic-crawler UA
];
const CLAUDEBOT_BASELINE_WEIGHT = 10; // out of the same pool as REGULAR_BOTS
const BYTESPIDER_BASELINE_WEIGHT = 4;
const CONVERSATION_BOTS = new Set(["ChatGPT-User", "Claude-User", "Perplexity-User"]);

const GENERIC_UA = "Mozilla/5.0 (compatible; SomeRandomCrawler/1.3; +https://example.org/bot)";

function uaFor(botName: string): string {
  if (botName === "__unknown__") return GENERIC_UA;
  const ua = FULL_UA_SAMPLES[botName];
  if (!ua) throw new Error(`No FULL_UA_SAMPLES entry for ${botName}`);
  return ua;
}

// ---------------------------------------------------------------------------
// IP hash pool — small, deterministic, per-platform fake hex strings. Not a
// real hash, just needs to look plausible and be stable.
// ---------------------------------------------------------------------------

function fakeIpHash(platform: string, poolIndex: number): string {
  const base = Buffer.from(`${platform}:${poolIndex}`).toString("hex");
  return (base + "0".repeat(64)).slice(0, 64);
}

// ---------------------------------------------------------------------------
// Event shape
// ---------------------------------------------------------------------------

interface SeedEvent {
  site_id: string;
  occurred_at: string;
  user_agent: string;
  bot_name: string;
  platform: string;
  bot_category: string;
  page_url: string;
  page_path: string;
  status_code: number | null;
  method: string | null;
  source: string;
  is_verification: boolean;
  ip_hash: string;
}

function buildEvent(params: {
  siteId: string;
  botName: string;
  date: Date;
  hour: number;
  rng: () => number;
}): SeedEvent {
  const { siteId, botName, date, hour, rng } = params;
  const ua = uaFor(botName);
  const classification = classifyBot(ua);
  if (!classification) throw new Error(`UA for ${botName} failed to classify: ${ua}`);

  const isConvoBot = CONVERSATION_BOTS.has(botName);
  let path: string;
  if (isConvoBot) {
    const dayIndex = Math.floor(
      (date.getTime() - dateForDay(0).getTime()) / (24 * 60 * 60 * 1000),
    );
    const week = Math.min(4, Math.floor(dayIndex / 7));
    const storyShare = CONVO_STORY_SHARE_BY_WEEK[week];
    if (rng() < storyShare) {
      path = rng() < 0.5 ? PRICING_PATH : AI_VISIBILITY_PATH;
    } else {
      path = weightedPick(rng, CONVO_OTHER_PAGES);
    }
  } else {
    path = weightedPick(rng, REGULAR_PAGE_WEIGHTS);
  }

  const minute = Math.floor(rng() * 60);
  const second = Math.floor(rng() * 60);
  const occurredAt = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      hour,
      minute,
      second,
    ),
  );

  const isOldApi = path === OLD_API_PATH;
  const isServer = isOldApi ? true : rng() < 0.6;
  let statusCode: number | null = null;
  let method: string | null = null;
  if (isServer) {
    method = "GET";
    if (isOldApi) {
      statusCode = 404;
    } else {
      const r = rng();
      statusCode = r < 0.95 ? 200 : 301;
    }
  }

  const source = isServer ? "server" : "pixel";
  const ipPoolIndex = Math.floor(rng() * 5);

  return {
    site_id: siteId,
    occurred_at: occurredAt.toISOString(),
    user_agent: ua,
    bot_name: classification.name,
    platform: classification.platform,
    bot_category: classification.category,
    page_url: `https://${DEMO_DOMAIN}${path}`,
    page_path: path,
    status_code: statusCode,
    method,
    source,
    is_verification: false,
    ip_hash: fakeIpHash(classification.platform, ipPoolIndex),
  };
}

// ---------------------------------------------------------------------------
// Window / date helpers — window ends at UTC midnight "today", so reruns on
// the same calendar day are byte-identical.
// ---------------------------------------------------------------------------

let WINDOW_DAYS = 30;
let WINDOW_END: Date; // exclusive upper bound, UTC midnight "today"

function dateForDay(dayIndex: number): Date {
  const start = new Date(WINDOW_END);
  start.setUTCDate(start.getUTCDate() - WINDOW_DAYS + dayIndex);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

// ---------------------------------------------------------------------------
// Main generation
// ---------------------------------------------------------------------------

function generateEvents(siteId: string, totalDays: number, totalEvents: number): SeedEvent[] {
  WINDOW_DAYS = totalDays;
  const now = new Date();
  WINDOW_END = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const rng = mulberry32(RNG_SEED);
  const events: SeedEvent[] = [];

  // --- Reserved special-event budgets, carved out of totalEvents up front ---

  // CCBot: bursty. Two single-day batches of 200-400 events; silent
  // otherwise. Burst days fixed at day-indices 9 and 19 (of 0..totalDays-1).
  const ccBurstDays = [9, 19];
  const ccBurstCounts = [300, 350];
  let ccTotal = 0;
  for (const c of ccBurstCounts) ccTotal += c;

  // DeepSeekBot: first-seen only in the last 3 days, ~40 events total.
  const deepSeekDays = [totalDays - 3, totalDays - 2, totalDays - 1];
  const deepSeekCounts = [10, 14, 16]; // sums to 40, ramps up as "adoption" grows
  const deepSeekTotal = deepSeekCounts.reduce((a, b) => a + b, 0);

  const reserved = ccTotal + deepSeekTotal;
  const regularBudget = totalEvents - reserved;

  // --- Regular pool: per-day totals shaped by weekday/diurnal factor ---

  const dayFactors: number[] = [];
  for (let d = 0; d < totalDays; d++) {
    dayFactors.push(dailyShapeFactor(dateForDay(d), d, totalDays));
  }
  const factorSum = dayFactors.reduce((a, b) => a + b, 0);
  const dayTotals = dayFactors.map((f) => Math.round((f / factorSum) * regularBudget));
  // Fix rounding drift on the last day so the regular pool sums exactly.
  const roundedSum = dayTotals.reduce((a, b) => a + b, 0);
  dayTotals[dayTotals.length - 1] += regularBudget - roundedSum;

  // Average regular-pool day total, used to derive fixed baselines for
  // ClaudeBot's ramp and Bytespider's spike so both are anchored to a
  // stable number rather than that day's (possibly perturbed) total.
  const avgDayTotal = regularBudget / totalDays;
  const totalBotWeight =
    REGULAR_BOTS.reduce((s, b) => s + b.weight, 0) +
    CLAUDEBOT_BASELINE_WEIGHT +
    BYTESPIDER_BASELINE_WEIGHT;
  const claudeAvgDaily = avgDayTotal * (CLAUDEBOT_BASELINE_WEIGHT / totalBotWeight);
  const bytespiderAvgDaily = avgDayTotal * (BYTESPIDER_BASELINE_WEIGHT / totalBotWeight);
  // claudeAvgDaily is the mean of the linear ramp; solve for day-0 baseline A
  // such that mean over `totalDays` of A*(1 + d/(totalDays-1)) == claudeAvgDaily.
  // mean multiplier = 1 + (totalDays-1)/(2*(totalDays-1)) = 1.5, so A = avg/1.5.
  const claudeRampBaseline = claudeAvgDaily / 1.5;

  const BYTESPIDER_SPIKE_DAY = 24; // "day 25", 1-indexed
  const BYTESPIDER_SPIKE_MULTIPLIER = 5;

  for (let d = 0; d < totalDays; d++) {
    const date = dateForDay(d);
    const dayTotal = dayTotals[d];

    const claudeCount = Math.round(claudeRampCount(d, totalDays, claudeRampBaseline));
    const bytespiderCount = Math.round(
      d === BYTESPIDER_SPIKE_DAY
        ? bytespiderAvgDaily * BYTESPIDER_SPIKE_MULTIPLIER
        : bytespiderAvgDaily,
    );

    const remaining = Math.max(0, dayTotal - claudeCount - bytespiderCount);
    const otherBotWeightSum = REGULAR_BOTS.reduce((s, b) => s + b.weight, 0);

    // ClaudeBot for this day.
    emitBotEvents(events, siteId, "ClaudeBot", claudeCount, date, rng);
    // Bytespider for this day.
    emitBotEvents(events, siteId, "Bytespider", bytespiderCount, date, rng);
    // All other regular bots, proportioned within `remaining`.
    for (const bot of REGULAR_BOTS) {
      const count = Math.round((bot.weight / otherBotWeightSum) * remaining);
      emitBotEvents(events, siteId, bot.value, count, date, rng);
    }
  }

  // --- CCBot bursts ---
  ccBurstDays.forEach((d, i) => {
    emitBotEvents(events, siteId, "CCBot", ccBurstCounts[i], dateForDay(d), rng);
  });

  // --- DeepSeekBot, last 3 days only ---
  deepSeekDays.forEach((d, i) => {
    emitBotEvents(events, siteId, "DeepSeekBot", deepSeekCounts[i], dateForDay(d), rng);
  });

  return events;
}

function emitBotEvents(
  out: SeedEvent[],
  siteId: string,
  botName: string,
  count: number,
  date: Date,
  rng: () => number,
) {
  for (let i = 0; i < count; i++) {
    const hour = pickHour(rng);
    out.push(buildEvent({ siteId, botName, date, hour, rng }));
  }
}

function pickHour(rng: () => number): number {
  const hourItems: Weighted<number>[] = [];
  for (let h = 0; h < 24; h++) hourItems.push({ value: h, weight: hourWeight(h) });
  return weightedPick(rng, hourItems);
}

// ---------------------------------------------------------------------------
// Supabase I/O
// ---------------------------------------------------------------------------

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (check .env.local)",
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    // Node 20 lacks a native WebSocket; supabase-js needs one to construct
    // its realtime client even though this script only does plain inserts.
    realtime: { transport: ws as never },
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supabase = createServiceClient();

  const { data: site, error: siteError } = await supabase
    .from("sites")
    .select("id, domain")
    .eq("id", args.site)
    .maybeSingle();
  if (siteError) throw siteError;
  if (!site) {
    console.error(`No site found with id ${args.site}`);
    process.exit(1);
  }
  console.log(`Seeding site ${site.id} (${site.domain})`);

  if (args.reset) {
    console.log("Resetting: deleting existing crawler_events for this site...");
    const { error: delError } = await supabase
      .from("crawler_events")
      .delete()
      .eq("site_id", args.site);
    if (delError) throw delError;
  }

  console.log(`Generating ${args.events} events across ${args.days} days (seed=${RNG_SEED})...`);
  const events = generateEvents(args.site, args.days, args.events);
  console.log(`Generated ${events.length} events. Inserting in batches of ${BATCH_SIZE}...`);

  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("crawler_events").insert(batch);
    if (error) throw error;
    process.stdout.write(
      `\rInserted ${Math.min(i + BATCH_SIZE, events.length)}/${events.length}`,
    );
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
