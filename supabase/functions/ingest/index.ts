// supabase/functions/ingest/index.ts
//
// Public ingestion endpoint for crawler-visit events. Two shapes:
//   - POST: JSON body from middleware / simulator / verification harness.
//   - GET:  1x1 pixel beacon fired from a page (sid, u query params).
//
// This function is deployed with verify_jwt = false (see supabase/config.toml
// [functions.ingest]) because it is a public endpoint that unauthenticated
// site visitors' browsers and third-party crawlers hit directly — there is
// no user session to attach a JWT to.
//
// Auth model: RLS on crawler_events has no public INSERT policy, so this
// function uses the service-role key (available automatically at runtime as
// the SUPABASE_SERVICE_ROLE_KEY env var injected by the edge runtime) to
// bypass RLS for the insert. Never expose the service-role key to clients.

import { createClient } from "npm:@supabase/supabase-js@2";
import { classifyBot } from "../_shared/bot-registry.ts";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
};

const MAX_BODY_BYTES = 4 * 1024; // 4KB
const MAX_UA_LEN = 512;
const MAX_URL_LEN = 2048;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const IP_HASH_SALT = Deno.env.get("IP_HASH_SALT")!;
if (!IP_HASH_SALT) {
  throw new Error("IP_HASH_SALT is not set — refusing to hash IPs unsalted");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

interface IngestBody {
  site_id?: string;
  page_url?: string;
  user_agent?: string;
  status_code?: number;
  method?: string;
  source?: string;
  is_verification?: boolean;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function noContentResponse(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** Derive the pathname from a page_url that may be a full URL or a bare path. */
function computePagePath(pageUrl: string): string {
  try {
    return new URL(pageUrl).pathname || "/";
  } catch {
    // Not a valid absolute URL — treat the input as already being a path.
    return pageUrl.startsWith("/") ? pageUrl : `/${pageUrl}`;
  }
}

/** First hop of a comma-separated x-forwarded-for header. */
function firstForwardedIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  // Fall back to whatever the platform sets for the direct connection.
  return req.headers.get("x-real-ip") ?? "unknown";
}

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(IP_HASH_SALT + ip);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Looks up a site by id and returns its registered bare host (e.g.
 * "example.com"), or null when the site doesn't exist. The domain is needed
 * for domain-binding: we reject events whose `page_url` claims a host that
 * isn't the customer's own site, so a leaked (inherently public) site_id
 * can't be used to inject spoofed traffic for arbitrary pages.
 */
async function getSiteDomain(siteId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("sites")
    .select("domain")
    .eq("id", siteId)
    .maybeSingle();
  if (error) {
    console.error("site lookup error", error);
    return null;
  }
  return data?.domain ?? null;
}

/**
 * True when `pageUrl`'s host is the site's registered domain or a subdomain
 * of it. Ports are ignored on both sides. When `pageUrl` has no parseable
 * host (a bare path — tolerated by computePagePath for defensive callers) we
 * can't verify origin, so we allow it: the main goal is to reject events that
 * explicitly claim a *different* domain, not to require a full URL.
 */
function hostMatchesDomain(pageUrl: string, domain: string): boolean {
  let host: string;
  try {
    host = new URL(pageUrl).hostname.toLowerCase();
  } catch {
    return true; // no host to check — best effort
  }
  const registered = domain.split(":")[0].replace(/^www\./, "");
  host = host.replace(/^www\./, "");
  return host === registered || host.endsWith(`.${registered}`);
}

async function insertEvent(params: {
  siteId: string;
  userAgent: string;
  pageUrl: string;
  statusCode: number | null;
  method: string | null;
  source: string;
  isVerification: boolean;
  ip: string;
}): Promise<Response> {
  const classification = classifyBot(params.userAgent);
  if (!classification) {
    // Human traffic — not a bot, nothing to record.
    return noContentResponse();
  }

  const pagePath = computePagePath(params.pageUrl);
  const ipHash = await hashIp(params.ip);

  const { error } = await supabase.from("crawler_events").insert({
    site_id: params.siteId,
    user_agent: params.userAgent.slice(0, MAX_UA_LEN),
    bot_name: classification.name,
    platform: classification.platform,
    bot_category: classification.category,
    page_url: params.pageUrl.slice(0, MAX_URL_LEN),
    page_path: pagePath,
    status_code: params.statusCode,
    method: params.method,
    source: params.source,
    is_verification: params.isVerification,
    ip_hash: ipHash,
  });

  if (error) {
    console.error("insert error", error);
    return jsonResponse({ error: "insert_failed" }, 500);
  }

  return noContentResponse();
}

async function handleGet(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const siteId = url.searchParams.get("sid");
  const pageUrl = url.searchParams.get("u");
  const userAgent = req.headers.get("user-agent") ?? "";

  if (!siteId || !pageUrl) {
    return jsonResponse({ error: "missing sid or u" }, 400);
  }

  const domain = await getSiteDomain(siteId);
  if (!domain) {
    return jsonResponse({ error: "site not found" }, 404);
  }
  if (!hostMatchesDomain(pageUrl, domain)) {
    return jsonResponse({ error: "domain_mismatch" }, 403);
  }

  return insertEvent({
    siteId,
    userAgent,
    pageUrl,
    statusCode: null,
    method: "GET",
    source: "pixel",
    isVerification: false,
    ip: firstForwardedIp(req),
  });
}

async function handlePost(req: Request): Promise<Response> {
  const contentLength = req.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return jsonResponse({ error: "payload too large" }, 413);
  }

  const rawBody = await req.text();
  if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
    return jsonResponse({ error: "payload too large" }, 413);
  }

  let body: IngestBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "invalid json" }, 400);
  }

  const { site_id, page_url, user_agent } = body;
  if (!site_id || !page_url || !user_agent) {
    return jsonResponse({ error: "missing site_id, page_url, or user_agent" }, 400);
  }

  const domain = await getSiteDomain(site_id);
  if (!domain) {
    return jsonResponse({ error: "site not found" }, 404);
  }
  if (!hostMatchesDomain(page_url, domain)) {
    return jsonResponse({ error: "domain_mismatch" }, 403);
  }

  return insertEvent({
    siteId: site_id,
    userAgent: user_agent,
    pageUrl: page_url,
    statusCode: typeof body.status_code === "number" ? body.status_code : null,
    method: body.method ?? "POST",
    source: body.source ?? "server",
    isVerification: body.is_verification ?? false,
    ip: firstForwardedIp(req),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    if (req.method === "GET") {
      return await handleGet(req);
    }
    if (req.method === "POST") {
      return await handlePost(req);
    }
    return jsonResponse({ error: "method not allowed" }, 405);
  } catch (err) {
    console.error("unhandled error", err);
    return jsonResponse({ error: "internal error" }, 500);
  }
});
