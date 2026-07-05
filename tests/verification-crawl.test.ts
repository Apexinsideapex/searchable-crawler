import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";
import { FULL_UA_SAMPLES } from "../shared/bot-registry";

// Exercises the same contract sendTestCrawl() / checkVerificationEvent()
// (app/dashboard/actions.ts) rely on: POST a verification event through the
// real deployed ingest Edge Function (not a direct DB write), then read it
// back through the is_verification + time-window query those actions use.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ingestUrl = `${url.replace(/\/$/, "")}/functions/v1/ingest`;

const clientOptions = { realtime: { transport: ws as never } };

const service = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  ...clientOptions,
});

async function fetchRecentVerification(client: SupabaseClient, siteId: string) {
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  return client
    .from("crawler_events")
    .select("occurred_at, source, is_verification, bot_name, platform")
    .eq("site_id", siteId)
    .eq("is_verification", true)
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

describe("verification crawl flow", () => {
  let ownerClient: SupabaseClient;
  let otherClient: SupabaseClient;
  let ownerId: string;
  let otherId: string;
  let siteId: string;

  beforeAll(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const password = "test-password-123";

    const { data: owner, error: ownerError } = await service.auth.admin.createUser({
      email: `verify-owner-${suffix}@example.com`,
      password,
      email_confirm: true,
    });
    if (ownerError || !owner.user) throw ownerError ?? new Error("no owner");
    ownerId = owner.user.id;

    const { data: other, error: otherError } = await service.auth.admin.createUser({
      email: `verify-other-${suffix}@example.com`,
      password,
      email_confirm: true,
    });
    if (otherError || !other.user) throw otherError ?? new Error("no other");
    otherId = other.user.id;

    ownerClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      ...clientOptions,
    });
    await ownerClient.auth.signInWithPassword({
      email: `verify-owner-${suffix}@example.com`,
      password,
    });

    otherClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      ...clientOptions,
    });
    await otherClient.auth.signInWithPassword({
      email: `verify-other-${suffix}@example.com`,
      password,
    });

    const { data: site, error: siteError } = await service
      .from("sites")
      .insert({ user_id: ownerId, domain: `verify-${suffix}.example.com` })
      .select()
      .single();
    if (siteError || !site) throw siteError ?? new Error("no site");
    siteId = site.id;
  }, 30000);

  afterAll(async () => {
    await service.auth.admin.deleteUser(ownerId);
    await service.auth.admin.deleteUser(otherId);
  });

  it("lands a verification event through the live ingest endpoint, readable only by the owner", async () => {
    const res = await fetch(ingestUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        site_id: siteId,
        page_url: "https://verify.example.com/",
        user_agent: FULL_UA_SAMPLES.GPTBot,
        source: "verification",
        is_verification: true,
      }),
    });
    expect(res.status).toBe(204);

    const { data: ownerRow, error: ownerError } = await fetchRecentVerification(
      ownerClient,
      siteId,
    );
    expect(ownerError).toBeNull();
    expect(ownerRow).toMatchObject({
      source: "verification",
      is_verification: true,
      bot_name: "GPTBot",
      platform: "OpenAI",
    });

    const { data: otherRow, error: otherError } = await fetchRecentVerification(
      otherClient,
      siteId,
    );
    expect(otherError).toBeNull();
    expect(otherRow).toBeNull();
  }, 15000);

  it("does not report a verification event for a site with none", async () => {
    const { data: site } = await service
      .from("sites")
      .insert({ user_id: ownerId, domain: `verify-empty-${Date.now()}.example.com` })
      .select()
      .single();

    const { data, error } = await fetchRecentVerification(ownerClient, site!.id);
    expect(error).toBeNull();
    expect(data).toBeNull();
  });
});
