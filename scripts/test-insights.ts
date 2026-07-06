import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";

import WebSocket from 'ws';

// Load environment variables (from .env.local if present)
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role for script bypassing RLS
const geminiApiKey = process.env.GEMINI_API_KEY;

if (!supabaseUrl || !supabaseKey || !geminiApiKey) {
  console.error("Missing required environment variables.");
  console.log("Ensure NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and GEMINI_API_KEY are set.");
  process.exit(1);
}

// Node 20 workaround for Supabase Realtime
if (!globalThis.WebSocket) {
  (globalThis as any).WebSocket = WebSocket;
}

const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
const ai = new GoogleGenAI({ apiKey: geminiApiKey });

async function runTest() {
  console.log("1. Fetching a test site_id...");
  const { data: sites, error: siteError } = await supabase.from("sites").select("id").limit(1);
  
  if (siteError || !sites || sites.length === 0) {
    console.error("Failed to find a site:", siteError);
    return;
  }
  const siteId = sites[0].id;
  console.log(`Using site_id: ${siteId}`);

  // Calculate timeframes (last 7 days vs previous 7 days)
  const now = new Date();
  const to = now.toISOString();
  
  const fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const from = fromDate.toISOString();
  
  const prevToDate = new Date(fromDate.getTime() - 1);
  const prev_to = prevToDate.toISOString();
  
  const prevFromDate = new Date(prevToDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  const prev_from = prevFromDate.toISOString();

  console.log("\n2. Calling get_insights_context RPC...");
  const { data: contextBlob, error: rpcError } = await supabase.rpc(
    "get_insights_context",
    {
      p_site_id: siteId,
      p_from: from,
      p_to: to,
      p_prev_from: prev_from,
      p_prev_to: prev_to,
    }
  );

  if (rpcError) {
    console.error("RPC Error:", rpcError);
    return;
  }

  console.log("Context Blob retrieved successfully:");
  console.log(JSON.stringify(contextBlob, null, 2));

  console.log("\n3. Calling Gemini API (gemini-3.1-pro-preview)...");
  
  const systemInstruction = `You are an expert Technical SEO and AI Engine Optimization (AEO) analyst. 
Review the provided crawl analytics context. Your job is to identify the 3 to 5 most important insights. 
Focus on anomalies, spikes in specific AI platforms, and technical errors.

You MUST return ONLY a JSON object matching this exact schema:
{
  "insights": [
    {
      "severity": "info" | "warning" | "critical",
      "headline": "string",
      "body": "string",
      "affected_pages": ["string"],
      "suggested_action": "string"
    }
  ]
}

Do NOT wrap the response in markdown code blocks (\`\`\`json). Return the raw JSON object directly.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: JSON.stringify(contextBlob),
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
      },
    });

    const outputText = response.text || "";
    console.log("\n--- GEMINI RESPONSE ---");
    console.log(outputText);
    console.log("-----------------------");
    
    // Verify it parses
    JSON.parse(outputText);
    console.log("\n✅ Success: Response is valid JSON.");
  } catch (error) {
    console.error("Gemini Error:", error);
  }
}

runTest();