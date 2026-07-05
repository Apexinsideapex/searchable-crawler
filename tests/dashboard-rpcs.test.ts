import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Node 20 lacks a native WebSocket; supabase-js needs one for realtime setup
// even though these tests only exercise plain REST/RPC calls.
const clientOptions = { realtime: { transport: ws as never } };

const service = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  ...clientOptions,
});

const HOUR = 60 * 60 * 1000;

type TestUser = {
  id: string;
  client: SupabaseClient;
  siteId: string;
};

async function createTestUser(label: string): Promise<TestUser> {
  const email = `dashboard-rpc-${label}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}@example.com`;
  const password = "test-password-123";

  const { data: created, error: createError } =
    await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (createError || !created.user) {
    throw createError ?? new Error("Failed to create test user");
  }

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    ...clientOptions,
  });
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) throw signInError;

  const { data: site, error: siteError } = await service
    .from("sites")
    .insert({ user_id: created.user.id, domain: `${label}.dashboard-rpc.example.com` })
    .select()
    .single();
  if (siteError || !site) throw siteError ?? new Error("Failed to create site");

  return { id: created.user.id, client, siteId: site.id };
}

async function insertEvent(
  siteId: string,
  overrides: Partial<{
    occurred_at: string;
    bot_name: string;
    platform: string;
    bot_category: string;
    page_path: string;
    page_url: string;
  }>,
) {
  const { error } = await service.from("crawler_events").insert({
    site_id: siteId,
    user_agent: "test-agent/1.0",
    bot_name: "GPTBot",
    platform: "OpenAI",
    bot_category: "training",
    page_url: "https://example.com/",
    page_path: "/",
    source: "simulator",
    ...overrides,
  });
  if (error) throw error;
}

describe("dashboard RPCs", () => {
  let user: TestUser;
  let otherUser: TestUser;

  beforeAll(async () => {
    user = await createTestUser("main");
    otherUser = await createTestUser("other");
  }, 30000);

  afterAll(async () => {
    await service.auth.admin.deleteUser(user.id);
    await service.auth.admin.deleteUser(otherUser.id);
  });

  describe("stats_summary", () => {
    const now = Date.now();
    const from = new Date(now - 24 * HOUR);
    const to = new Date(now);
    const prevFrom = new Date(now - 48 * HOUR);
    const prevTo = from;

    beforeAll(async () => {
      // current window: 3 training, 2 indexing, 1 conversations = 6 total
      await insertEvent(user.siteId, {
        occurred_at: new Date(now - 1 * HOUR).toISOString(),
        bot_category: "training",
      });
      await insertEvent(user.siteId, {
        occurred_at: new Date(now - 5 * HOUR).toISOString(),
        bot_category: "training",
      });
      await insertEvent(user.siteId, {
        occurred_at: new Date(now - 20 * HOUR).toISOString(),
        bot_category: "training",
      });
      await insertEvent(user.siteId, {
        occurred_at: new Date(now - 2 * HOUR).toISOString(),
        bot_category: "indexing",
      });
      await insertEvent(user.siteId, {
        occurred_at: new Date(now - 10 * HOUR).toISOString(),
        bot_category: "indexing",
      });
      await insertEvent(user.siteId, {
        occurred_at: new Date(now - 3 * HOUR).toISOString(),
        bot_category: "conversations",
      });

      // previous window: 1 training, 1 indexing, 1 conversations = 3 total
      await insertEvent(user.siteId, {
        occurred_at: new Date(now - 30 * HOUR).toISOString(),
        bot_category: "training",
      });
      await insertEvent(user.siteId, {
        occurred_at: new Date(now - 40 * HOUR).toISOString(),
        bot_category: "indexing",
      });
      await insertEvent(user.siteId, {
        occurred_at: new Date(now - 25 * HOUR).toISOString(),
        bot_category: "conversations",
      });
    });

    it("returns exact counts for both the current and equal-length previous window", async () => {
      const { data, error } = await user.client.rpc("stats_summary", {
        p_site_id: user.siteId,
        p_from: from.toISOString(),
        p_to: to.toISOString(),
        p_prev_from: prevFrom.toISOString(),
        p_prev_to: prevTo.toISOString(),
      });
      expect(error).toBeNull();
      const row = data![0];
      expect(row).toMatchObject({
        total: 6,
        training: 3,
        indexing: 2,
        conversations: 1,
        prev_total: 3,
        prev_training: 1,
        prev_indexing: 1,
        prev_conversations: 1,
      });

      // proves the two windows are equal-length and non-overlapping, not
      // just "some numbers" - hand-computed delta against the known counts
      const totalDelta = ((Number(row.total) - Number(row.prev_total)) / Number(row.prev_total)) * 100;
      expect(totalDelta).toBe(100);
      const trainingDelta =
        ((Number(row.training) - Number(row.prev_training)) / Number(row.prev_training)) * 100;
      expect(trainingDelta).toBe(200);
    });

    it("returns all zeros (not null) for a window with no events", async () => {
      const emptyFrom = new Date(now - 1000 * HOUR);
      const emptyTo = new Date(now - 999 * HOUR);
      const { data, error } = await user.client.rpc("stats_summary", {
        p_site_id: user.siteId,
        p_from: emptyFrom.toISOString(),
        p_to: emptyTo.toISOString(),
        p_prev_from: emptyFrom.toISOString(),
        p_prev_to: emptyTo.toISOString(),
      });
      expect(error).toBeNull();
      expect(data![0]).toMatchObject({
        total: 0,
        training: 0,
        indexing: 0,
        conversations: 0,
      });
    });

    it("does not leak another user's events into the count", async () => {
      // stats_summary is a GROUP-BY-less aggregate, so it always returns
      // exactly one row - RLS hiding every underlying row correctly shows up
      // as one row of all zeros, not an empty result set.
      const { data, error } = await otherUser.client.rpc("stats_summary", {
        p_site_id: user.siteId,
        p_from: from.toISOString(),
        p_to: to.toISOString(),
        p_prev_from: prevFrom.toISOString(),
        p_prev_to: prevTo.toISOString(),
      });
      expect(error).toBeNull();
      expect(data![0]).toMatchObject({
        total: 0,
        training: 0,
        indexing: 0,
        conversations: 0,
        prev_total: 0,
      });
    });
  });

  describe("timeseries", () => {
    const base = new Date("2024-01-01T00:00:00.000Z");

    beforeAll(async () => {
      // bucket 00:00 - 2 training events
      await insertEvent(user.siteId, {
        occurred_at: new Date(base.getTime() + 15 * 60 * 1000).toISOString(),
        bot_category: "training",
      });
      await insertEvent(user.siteId, {
        occurred_at: new Date(base.getTime() + 45 * 60 * 1000).toISOString(),
        bot_category: "training",
      });
      // bucket 01:00 - 1 indexing event
      await insertEvent(user.siteId, {
        occurred_at: new Date(base.getTime() + 90 * 60 * 1000).toISOString(),
        bot_category: "indexing",
      });
      // bucket 02:00 - nothing inserted, must still appear zero-filled
    });

    it("returns dense, zero-filled hourly buckets for all 3 categories", async () => {
      const { data, error } = await user.client.rpc("timeseries", {
        p_site_id: user.siteId,
        p_from: base.toISOString(),
        p_to: new Date(base.getTime() + 3 * HOUR).toISOString(),
        p_bucket: "1 hour",
        p_category: null,
        p_platforms: null,
      });
      expect(error).toBeNull();
      // 3 buckets x 3 categories = 9 dense rows
      expect(data).toHaveLength(9);

      const bucket0 = base.getTime();
      const bucket1 = base.getTime() + HOUR;
      const bucket2 = base.getTime() + 2 * HOUR;

      // compare by parsed timestamp, not raw string - PostgREST serializes
      // timestamptz as e.g. "2024-01-01T00:00:00+00:00", which won't
      // string-match JS's own toISOString() "...Z" format
      const at = (bucketMs: number, category: string) =>
        Number(
          data!.find(
            (r: { bucket_start: string; category: string; count: number }) =>
              new Date(r.bucket_start).getTime() === bucketMs &&
              r.category === category,
          )!.count,
        );

      expect(at(bucket0, "training")).toBe(2);
      expect(at(bucket0, "indexing")).toBe(0);
      expect(at(bucket0, "conversations")).toBe(0);
      expect(at(bucket1, "indexing")).toBe(1);
      expect(at(bucket1, "training")).toBe(0);
      expect(at(bucket2, "training")).toBe(0);
      expect(at(bucket2, "indexing")).toBe(0);
      expect(at(bucket2, "conversations")).toBe(0);
    });

    it("filters to a single category when p_category is set", async () => {
      const { data, error } = await user.client.rpc("timeseries", {
        p_site_id: user.siteId,
        p_from: base.toISOString(),
        p_to: new Date(base.getTime() + 3 * HOUR).toISOString(),
        p_bucket: "1 hour",
        p_category: "training",
        p_platforms: null,
      });
      expect(error).toBeNull();
      const bucket0 = base.getTime();
      const trainingRow = data!.find(
        (r: { bucket_start: string; category: string }) =>
          new Date(r.bucket_start).getTime() === bucket0 &&
          r.category === "training",
      );
      expect(Number(trainingRow!.count)).toBe(2);
      const indexingRow = data!.find(
        (r: { bucket_start: string; category: string; count: number }) =>
          r.category === "indexing",
      );
      expect(Number(indexingRow!.count)).toBe(0);
    });
  });

  describe("top_pages", () => {
    const base = new Date("2024-02-01T00:00:00.000Z");
    const from = base.toISOString();
    const to = new Date(base.getTime() + HOUR).toISOString();

    beforeAll(async () => {
      // page /popular: 3 visits, 2 distinct bots, 2xOpenAI + 1xAnthropic -> top_platform OpenAI
      await insertEvent(user.siteId, {
        occurred_at: new Date(base.getTime() + 1000).toISOString(),
        page_path: "/popular",
        page_url: "https://example.com/popular",
        bot_name: "GPTBot",
        platform: "OpenAI",
        bot_category: "training",
      });
      await insertEvent(user.siteId, {
        occurred_at: new Date(base.getTime() + 2000).toISOString(),
        page_path: "/popular",
        page_url: "https://example.com/popular",
        bot_name: "GPTBot",
        platform: "OpenAI",
        bot_category: "training",
      });
      await insertEvent(user.siteId, {
        occurred_at: new Date(base.getTime() + 3000).toISOString(),
        page_path: "/popular",
        page_url: "https://example.com/popular",
        bot_name: "ClaudeBot",
        platform: "Anthropic",
        bot_category: "indexing",
      });
      // page /quiet: 1 visit
      await insertEvent(user.siteId, {
        occurred_at: new Date(base.getTime() + 4000).toISOString(),
        page_path: "/quiet",
        page_url: "https://example.com/quiet",
        bot_name: "PerplexityBot",
        platform: "Perplexity",
        bot_category: "indexing",
      });
    });

    it("ranks pages by visit count and computes unique_bots/top_platform/last_seen", async () => {
      const { data, error } = await user.client.rpc("top_pages", {
        p_site_id: user.siteId,
        p_from: from,
        p_to: to,
        p_category: null,
        p_platforms: null,
      });
      expect(error).toBeNull();
      expect(data![0]).toMatchObject({
        page_path: "/popular",
        total_visits: 3,
        unique_bots: 2,
        top_platform: "OpenAI",
      });
      expect(new Date(data![0].last_seen).toISOString()).toBe(
        new Date(base.getTime() + 3000).toISOString(),
      );
      expect(data![1]).toMatchObject({ page_path: "/quiet", total_visits: 1 });
    });

    it("filters by category, excluding pages with no matching events", async () => {
      const { data, error } = await user.client.rpc("top_pages", {
        p_site_id: user.siteId,
        p_from: from,
        p_to: to,
        p_category: "training",
        p_platforms: null,
      });
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0]).toMatchObject({ page_path: "/popular", total_visits: 2 });
    });

    it("filters by platform", async () => {
      const { data, error } = await user.client.rpc("top_pages", {
        p_site_id: user.siteId,
        p_from: from,
        p_to: to,
        p_category: null,
        p_platforms: ["Perplexity"],
      });
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0]).toMatchObject({ page_path: "/quiet", total_visits: 1 });
    });
  });

  describe("platform_breakdown", () => {
    const base = new Date("2024-03-01T00:00:00.000Z");
    const from = base.toISOString();
    const to = new Date(base.getTime() + HOUR).toISOString();

    beforeAll(async () => {
      // OpenAI: 3 events (2 training, 1 indexing), Anthropic: 2, Perplexity: 1
      await insertEvent(user.siteId, {
        occurred_at: new Date(base.getTime() + 1000).toISOString(),
        platform: "OpenAI",
        bot_category: "training",
      });
      await insertEvent(user.siteId, {
        occurred_at: new Date(base.getTime() + 2000).toISOString(),
        platform: "OpenAI",
        bot_category: "training",
      });
      await insertEvent(user.siteId, {
        occurred_at: new Date(base.getTime() + 3000).toISOString(),
        platform: "OpenAI",
        bot_category: "indexing",
      });
      await insertEvent(user.siteId, {
        occurred_at: new Date(base.getTime() + 4000).toISOString(),
        platform: "Anthropic",
        bot_category: "training",
      });
      await insertEvent(user.siteId, {
        occurred_at: new Date(base.getTime() + 5000).toISOString(),
        platform: "Anthropic",
        bot_category: "training",
      });
      await insertEvent(user.siteId, {
        occurred_at: new Date(base.getTime() + 6000).toISOString(),
        platform: "Perplexity",
        bot_category: "indexing",
      });
    });

    it("ranks platforms by event count descending", async () => {
      const { data, error } = await user.client.rpc("platform_breakdown", {
        p_site_id: user.siteId,
        p_from: from,
        p_to: to,
        p_category: null,
        p_platforms: null,
      });
      expect(error).toBeNull();
      expect(data).toMatchObject([
        { platform: "OpenAI", count: 3 },
        { platform: "Anthropic", count: 2 },
        { platform: "Perplexity", count: 1 },
      ]);
    });

    it("filters by category", async () => {
      const { data, error } = await user.client.rpc("platform_breakdown", {
        p_site_id: user.siteId,
        p_from: from,
        p_to: to,
        p_category: "training",
        p_platforms: null,
      });
      expect(error).toBeNull();
      // both platforms tie at 2 for the training category; the RPC's
      // tiebreak is alphabetical by platform (Anthropic < OpenAI)
      expect(data).toMatchObject([
        { platform: "Anthropic", count: 2 },
        { platform: "OpenAI", count: 2 },
      ]);
    });

    it("does not leak another user's events into the breakdown", async () => {
      const { data, error } = await otherUser.client.rpc("platform_breakdown", {
        p_site_id: user.siteId,
        p_from: from,
        p_to: to,
        p_category: null,
        p_platforms: null,
      });
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });
  });
});
