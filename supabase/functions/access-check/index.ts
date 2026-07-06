import { createClient } from "npm:@supabase/supabase-js@2";
import robotsParser from "npm:robots-parser";
import { BOT_PATTERNS } from "../_shared/bot-registry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// We also want to check for the specific robots.txt control tokens, not just user agents
const CONTROL_TOKENS = ["Google-Extended", "Applebot-Extended"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { site_id } = await req.json();

    if (!site_id) {
      return new Response(JSON.stringify({ error: "Missing site_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase to get the domain
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: site, error: siteError } = await supabaseClient
      .from("sites")
      .select("domain")
      .eq("id", site_id)
      .single();

    if (siteError || !site) {
      throw new Error("Site not found");
    }

    // Ensure we have a valid URL protocol for fetching
    const domain = site.domain;
    const protocol = domain.startsWith("localhost") || domain.startsWith("127.0.0") ? "http" : "https";
    const baseUrl = `${protocol}://${domain}`;

    // 1. Fetch robots.txt
    const robotsUrl = `${baseUrl}/robots.txt`;
    let robotsTxtContent = "";
    let robotsFound = false;

    try {
      // Short timeout so we don't hang the UI if the site is slow
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const robotsRes = await fetch(robotsUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (robotsRes.ok) {
        robotsTxtContent = await robotsRes.text();
        robotsFound = true;
      }
    } catch (e) {
      console.warn(`Failed to fetch robots.txt for ${domain}:`, e);
    }

    // 2. Fetch llms.txt (HEAD request just to see if it exists)
    const llmsUrl = `${baseUrl}/llms.txt`;
    let llmsFound = false;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const llmsRes = await fetch(llmsUrl, { method: "HEAD", signal: controller.signal });
      clearTimeout(timeoutId);
      if (llmsRes.ok) {
        llmsFound = true;
      }
    } catch (e) {
      console.warn(`Failed to check llms.txt for ${domain}:`, e);
    }

    // 3. Parse and evaluate bots
    const parser = robotsParser(robotsUrl, robotsTxtContent);
    const results: Record<string, { allowed: boolean | undefined; isToken: boolean }> = {};

    // Get unique bot names from our registry
    const uniqueBots = Array.from(new Set(BOT_PATTERNS.map((b) => b.name)));

    // Test standard user agents
    for (const botName of uniqueBots) {
      if (botName === "Unknown") continue;
      
      let allowed: boolean | undefined = undefined;
      if (robotsFound) {
        // robots-parser returns true (allowed), false (disallowed), or undefined (not specified)
        const isAllowed = parser.isAllowed(baseUrl, botName);
        allowed = isAllowed;
      }
      results[botName] = { allowed, isToken: false };
    }

    // Test specific control tokens
    for (const token of CONTROL_TOKENS) {
      let allowed: boolean | undefined = undefined;
      if (robotsFound) {
         const isAllowed = parser.isAllowed(baseUrl, token);
         allowed = isAllowed;
      }
      results[token] = { allowed, isToken: true };
    }

    return new Response(JSON.stringify({ 
      domain, 
      robotsFound, 
      llmsFound, 
      matrix: results 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in access-check function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
