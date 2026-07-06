# Phase 5 — Intelligence Layer / Wow Factor (Budget: 2.0h)

**Context:** The Realtime Live Feed (5.1) has been cut from scope. We are focusing on the Gemini-powered Intelligence Brief and the robots.txt Access Check.

## 5.1 Gemini Intelligence Brief (P0)

### Edge Function `insights`
- **Auth:** Called from the dashboard with the user's JWT; verify site ownership.
- **Context blob** assembled server-side using predetermined SQL queries:
  - Category totals current vs previous period (+ deltas)
  - Top 15 pages with visit counts + per-category split
  - Per-platform totals + deltas
  - First-seen bots in last 7 days
  - Status-code distribution per page where non-200
- **LLM call:** Google Gen AI SDK using model `gemini-3.1-pro-preview`. `GEMINI_API_KEY` as Supabase secret.
- **System prompt:** "You are an expert Technical SEO and AI Engine Optimization (AEO) analyst. Review the provided crawl analytics context. Your job is to identify the 3 to 5 most important insights. Focus on anomalies, spikes in specific AI platforms, and technical errors. Return ONLY a JSON object matching this schema: `{ insights: [{ severity: 'info'|'warning'|'critical', headline, body, affected_pages: string[], suggested_action }] }`. Do not use markdown code fences."
- **Cache:** Upsert into `insights_cache`; serve cached if `generated_at` < 4h old; "Refresh" button bypasses.
- **Deterministic fallback:** If the LLM call fails or returns bad JSON, compute 2–3 rule-based insights from the same context blob.

### UI
- "Intelligence Brief" card at the top of the dashboard: severity icon, headline, expandable body, affected page chips (clicking one filters the Pages tab), generated-at timestamp, refresh button, subtle "AI-generated" note.

## 5.2 Access Check (P1)
- Edge Function `access-check`: fetch `https://<site.domain>/robots.txt` (+ HEAD `llms.txt`), parse User-agent blocks, return per-AI-bot allow/block matrix.
- UI: simple matrix table (bot × allowed?) + llms.txt found/not-found + one-line explainer for `Google-Extended`/`Applebot-Extended`.

## Acceptance checklist
- [ ] Insights brief renders 3–5 insights in the terminal/console first, then via UI.
- [ ] Model specifically verified as `gemini-3.1-pro-preview`.
- [ ] (If built) Access check renders a correct matrix for a known robots.txt.
