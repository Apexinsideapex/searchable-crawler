import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Node 20 lacks a native WebSocket; supabase-js needs one for realtime setup
// even though these tests only exercise plain REST queries.
const clientOptions = { realtime: { transport: ws as never } };

const service = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  ...clientOptions,
});

type TestUser = {
  id: string;
  email: string;
  password: string;
  client: SupabaseClient;
  siteId: string;
};

async function createTestUser(label: string): Promise<TestUser> {
  const email = `rls-test-${label}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}@example.com`;
  const password = "test-password-123";

  const { data: created, error: createError } =
    await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
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
    .insert({ user_id: created.user.id, domain: `${label}.example.com` })
    .select()
    .single();
  if (siteError || !site) throw siteError ?? new Error("Failed to create site");

  await service.from("crawler_events").insert({
    site_id: site.id,
    user_agent: "GPTBot/1.0",
    bot_name: "GPTBot",
    platform: "OpenAI",
    bot_category: "training",
    page_url: `https://${label}.example.com/`,
    page_path: "/",
    source: "simulator",
  });

  return { id: created.user.id, email, password, client, siteId: site.id };
}

describe("row level security", () => {
  let userA: TestUser;
  let userB: TestUser;

  beforeAll(async () => {
    userA = await createTestUser("a");
    userB = await createTestUser("b");
  });

  afterAll(async () => {
    await service.auth.admin.deleteUser(userA.id);
    await service.auth.admin.deleteUser(userB.id);
  });

  it("lets a user see only their own site", async () => {
    const { data, error } = await userA.client.from("sites").select();
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].id).toBe(userA.siteId);
  });

  it("lets a user see only their own crawler events", async () => {
    const { data, error } = await userA.client
      .from("crawler_events")
      .select();
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].site_id).toBe(userA.siteId);
  });

  it("does not leak user A's data to user B", async () => {
    const { data: sites } = await userB.client.from("sites").select();
    expect(sites!.every((s) => s.id !== userA.siteId)).toBe(true);

    const { data: events } = await userB.client
      .from("crawler_events")
      .select();
    expect(events!.every((e) => e.site_id !== userA.siteId)).toBe(true);
  });

  it("returns nothing for anonymous (unauthenticated) access", async () => {
    const anon = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      ...clientOptions,
    });
    const { data: sites, error: sitesError } = await anon
      .from("sites")
      .select();
    expect(sitesError).toBeNull();
    expect(sites).toHaveLength(0);

    const { data: events, error: eventsError } = await anon
      .from("crawler_events")
      .select();
    expect(eventsError).toBeNull();
    expect(events).toHaveLength(0);
  });

  it("blocks direct inserts into crawler_events by authenticated users", async () => {
    const { error } = await userA.client.from("crawler_events").insert({
      site_id: userA.siteId,
      user_agent: "test",
      page_url: "https://a.example.com/",
      page_path: "/",
    });
    expect(error).not.toBeNull();
  });
});
