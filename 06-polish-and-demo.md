# Phase 6 — Polish, Onboarding & Demo Prep (Budget: 1.5h)

**Context:** The panel judges the demo and the README, not the diff. This phase is P0. Close PRD AC-6 (install in <5 minutes) and package the story.

## 6.1 Onboarding flow (~40min)
1. Post-signup: "Add your site" → domain input → creates `sites` row → lands on Settings/Install.
2. **Install screen with two tabs** (this is where the server-side story is told in-product):
   - **Tab A — Pixel (30 seconds)**: copyable `<script>` snippet with the real site_id filled in. Caption: "Fastest install. Catches JS-executing AI agents: Applebot, Gemini, and browser-based AI agents."
   - **Tab B — Next.js Middleware (recommended)**: copyable `trackAiCrawlers` usage. Caption: "GPTBot, ClaudeBot and PerplexityBot never execute JavaScript (Vercel analyzed 500M+ fetches: zero JS execution) — they're invisible to browser scripts. Server-side sees every request. Install both for full coverage."
   - Both tabs: "Send test crawl" button + live "waiting for first event…" indicator that flips green via realtime when the first event lands. This IS the AC-6 proof.
3. Settings page: show site_id, domain, snippet again, CSV export link, delete site.

## 6.2 Visual polish pass (~20min)
- Consistent spacing/typography, platform logos or letter-badges, fixed category color system used identically in chart/chips/cards, favicon + app name (pick something clean, e.g. "CrawlerScope"), dark mode default.
- Loading skeletons for every async widget; zero layout shift on the demo path.

## 6.3 README.md (~20min) — structure:
1. One-line pitch + deployed URL + demo login (pre-seeded account).
2. 60-second architecture diagram (the master-plan ASCII, tidied).
3. **"Three things I changed from the PRD and why"** (master plan §2 — the JS-pixel blind spot, the Google-Extended token error, the 2026 taxonomy/bot list). Respectful, evidence-linked.
4. What's real vs seeded (be explicit: demo data is generated; simulator exercises the production pipeline end-to-end).
5. Honest limitations + v2 roadmap (spoofing/IP verification, log-drain integrations, dedup, alerts, crawl→cite→click funnel).
6. Local setup in ≤6 commands.

## 6.4 Demo rehearsal (~30min)
- Script in `DEMO.md` following master plan §5, with exact commands and clicks.
- Pre-demo checklist: fresh seeded account ready; simulator command in shell history; API key valid; insights cache warm (so the brief is instant) BUT rehearse one live refresh; verification button 3× green on the deployed URL.
- Record a 3–5 min Loom as backup against live-demo gremlins.

## Final acceptance (whole project)
- [ ] Stranger test: a new user can sign up, add a site, copy a snippet, click Send test crawl, and see the event — under 5 minutes, no guidance (AC-6).
- [ ] Every PRD AC (1–6) demonstrably closed on the DEPLOYED url.
- [ ] Demo script executes clean twice in a row.
- [ ] README reads as a principal-engineer artifact: decisions, trade-offs, corrections, roadmap.
- [ ] `DECISIONS.md` up to date.

## Cut-line reminder
If entering this phase >1h behind: cut 5.3 access check, cut Pages drawer, cut dark mode. Never cut onboarding, verification button, or the README.
