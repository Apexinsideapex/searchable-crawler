import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";
import {
  fetchCsvRows,
  fetchDistinctPlatforms,
  fetchFeedEvents,
  fetchStatsSummary,
  fetchTimeseries,
  fetchTopPages,
} from "../lib/dashboard/queries";
import { resolveDateWindow } from "../lib/dashboard/filters";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const clientOptions = { realtime: { transport: ws as never } };

const service = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  ...clientOptions,
});

describe("dashboard query wrappers", () => {
  let client: SupabaseClient;
  let userId: string;
  let siteId: string;
  const now = new Date();

  beforeAll(async () => {
    const email = `dashboard-queries-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}@example.com`;
    const password = "test-password-123";
    const { data: created, error: createError } =
      await service.auth.admin.createUser({ email, password, email_confirm: true });
    if (createError || !created.user) throw createError ?? new Error("no user");
    userId = created.user.id;

    client = createClient(url, anonKey, {
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
      .insert({ user_id: userId, domain: "queries-wrapper.example.com" })
      .select()
      .single();
    if (siteError || !site) throw siteError ?? new Error("no site");
    siteId = site.id;

    await service.from("crawler_events").insert([
      {
        site_id: siteId,
        occurred_at: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
        user_agent: "GPTBot/1.0, has,commas",
        bot_name: "GPTBot",
        platform: "OpenAI",
        bot_category: "training",
        page_url: "https://queries-wrapper.example.com/a",
        page_path: "/a",
        status_code: 200,
        source: "server",
      },
      {
        site_id: siteId,
        occurred_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        user_agent: "ChatGPT-User/1.0",
        bot_name: "ChatGPT-User",
        platform: "OpenAI",
        bot_category: "conversations",
        page_url: "https://queries-wrapper.example.com/b",
        page_path: "/b",
        status_code: 200,
        source: "server",
      },
    ]);
  }, 30000);

  afterAll(async () => {
    await service.auth.admin.deleteUser(userId);
  });

  it("fetchStatsSummary returns plain JS numbers (coerced from RPC bigint strings)", async () => {
    const window = resolveDateWindow("24h", now);
    const stats = await fetchStatsSummary(client, siteId, window);
    expect(stats.total).toBe(2);
    expect(stats.training).toBe(1);
    expect(stats.conversations).toBe(1);
    expect(typeof stats.total).toBe("number");
  });

  it("fetchTimeseries respects the category filter ('all' -> unfiltered RPC param)", async () => {
    const window = resolveDateWindow("24h", now);
    const all = await fetchTimeseries(client, siteId, window, "all", null);
    const trainingOnly = all.filter((p) => p.category === "training");
    expect(trainingOnly.reduce((sum, p) => sum + p.count, 0)).toBe(1);

    const filtered = await fetchTimeseries(client, siteId, window, "training", null);
    const nonTraining = filtered.filter((p) => p.category !== "training");
    expect(nonTraining.every((p) => p.count === 0)).toBe(true);
  });

  it("fetchTopPages ranks the two seeded pages", async () => {
    const window = resolveDateWindow("24h", now);
    const pages = await fetchTopPages(client, siteId, window, "all", null);
    expect(pages.map((p) => p.page_path).sort()).toEqual(["/a", "/b"]);
  });

  it("fetchFeedEvents returns rows newest-first with all expected fields", async () => {
    const window = resolveDateWindow("24h", now);
    const events = await fetchFeedEvents(client, siteId, window, "all", null);
    expect(events).toHaveLength(2);
    expect(events[0].page_path).toBe("/a");
    expect(events[1].page_path).toBe("/b");
  });

  it("fetchDistinctPlatforms returns the one seeded platform, deduplicated", async () => {
    const window = resolveDateWindow("24h", now);
    const platforms = await fetchDistinctPlatforms(client, siteId, window);
    expect(platforms).toEqual(["OpenAI"]);
  });

  it("fetchCsvRows applies the platform filter", async () => {
    const window = resolveDateWindow("24h", now);
    const rows = await fetchCsvRows(client, siteId, window, "all", ["OpenAI"]);
    expect(rows).toHaveLength(2);
    const rowsFilteredOut = await fetchCsvRows(client, siteId, window, "all", [
      "Anthropic",
    ]);
    expect(rowsFilteredOut).toHaveLength(0);
  });
});
