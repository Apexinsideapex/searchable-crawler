import { createClient } from "npm:@supabase/supabase-js@2";
import { GoogleGenAI } from "npm:@google/genai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS
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

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Calculate timeframes (last 7 days vs previous 7 days)
    const now = new Date();
    const to = now.toISOString();
    
    const fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const from = fromDate.toISOString();
    
    const prevToDate = new Date(fromDate.getTime() - 1);
    const prev_to = prevToDate.toISOString();
    
    const prevFromDate = new Date(prevToDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    const prev_from = prevFromDate.toISOString();

    // 1. Get the Context Blob from the Database
    console.log("Fetching context blob for site:", site_id);
    const { data: contextBlob, error: rpcError } = await supabaseClient.rpc(
      "get_insights_context",
      {
        p_site_id: site_id,
        p_from: from,
        p_to: to,
        p_prev_from: prev_from,
        p_prev_to: prev_to,
      }
    );

    if (rpcError) {
      console.error("RPC Error:", rpcError);
      throw rpcError;
    }

    console.log("Context Blob retrieved successfully:");
    console.log(JSON.stringify(contextBlob, null, 2));

    // 2. Call Gemini API
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY is not set in environment variables");
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

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

    console.log("Calling Gemini API (gemini-3.1-pro-preview)...");
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: JSON.stringify(contextBlob),
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
      },
    });

    const outputText = response.text;
    console.log("Gemini Raw Response:");
    console.log(outputText);

    // Attempt to parse to verify it's valid JSON
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(outputText);
    } catch (e) {
       console.error("Failed to parse Gemini output as JSON:", e);
       // Fallback logic would go here
       return new Response(JSON.stringify({ error: "LLM returned invalid JSON" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(parsedResponse), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in insights function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
