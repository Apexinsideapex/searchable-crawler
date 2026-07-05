"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeDomain } from "@/lib/dashboard/domain";
import { FULL_UA_SAMPLES } from "@/shared/bot-registry";

export type AddSiteFormState = { error: string | null };

export async function createSite(
  _prevState: AddSiteFormState,
  formData: FormData,
): Promise<AddSiteFormState> {
  const raw = (formData.get("domain") as string) ?? "";
  const domain = normalizeDomain(raw);
  if (!domain) {
    return { error: "Enter a valid domain, e.g. example.com" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: site, error } = await supabase
    .from("sites")
    .insert({ user_id: user.id, domain })
    .select("id")
    .single();

  if (error || !site) {
    return { error: error?.message ?? "Failed to create site" };
  }

  redirect(`/dashboard/${site.id}/settings`);
}

export async function deleteSite(formData: FormData): Promise<void> {
  const siteId = formData.get("siteId") as string;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("sites").delete().eq("id", siteId);
  redirect("/dashboard");
}

export type SendTestCrawlResult = { ok: true } | { ok: false; error: string };

// Fires a synthetic GPTBot visit through the real ingest Edge Function (not
// a direct DB write) so "Send test crawl" exercises the same pipeline real
// crawlers use. Ownership is checked here via RLS before calling out, since
// the public ingest endpoint itself only verifies the site_id exists.
export async function sendTestCrawl(siteId: string): Promise<SendTestCrawlResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: site, error: siteError } = await supabase
    .from("sites")
    .select("id, domain")
    .eq("id", siteId)
    .single();
  if (siteError || !site) return { ok: false, error: "Site not found" };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return { ok: false, error: "Ingest endpoint not configured" };
  const ingestUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/ingest`;

  try {
    const res = await fetch(ingestUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        site_id: site.id,
        page_url: `https://${site.domain}/`,
        user_agent: FULL_UA_SAMPLES.GPTBot,
        source: "verification",
        is_verification: true,
      }),
    });
    if (!res.ok) return { ok: false, error: `Ingest returned ${res.status}` };
  } catch {
    return { ok: false, error: "Could not reach the ingest endpoint" };
  }

  return { ok: true };
}

export type CheckVerificationResult = { found: boolean; occurredAt?: string };

// No realtime subscription yet (that's Phase 5's live feed) -- the client
// polls this on a timer/button-press instead of getting a push.
export async function checkVerificationEvent(
  siteId: string,
): Promise<CheckVerificationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { found: false };

  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("crawler_events")
    .select("occurred_at")
    .eq("site_id", siteId)
    .eq("is_verification", true)
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return { found: false };
  return { found: true, occurredAt: data.occurred_at };
}
