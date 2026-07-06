# Product Requirements Document
## AI Crawler Analytics Feature

| | |
|---|---|
| **Document Type** | Work Trial PRD |
| **Author** | Rohit Sharma |
| **Reference** | https://trakkr.ai/learn/docs/features/ai-crawlers |
| **Date** | July 1, 2026 |
| **Status** | Draft |
| **Timeline** | 2 days |

---

## 1. Executive Summary

Build an AI Crawler Analytics feature that monitors and tracks AI bot activity on websites. Website owners can see which AI platforms (ChatGPT, Claude, Perplexity, Gemini, etc.) are crawling their content, which pages they visit, and how often.

**Tech Stack:** Supabase (Postgres + Auth + Edge Functions), Next.js/React frontend

---

## 2. Problem Statement

Traditional analytics tools don't capture AI crawler activity. Website owners need visibility into how AI platforms interact with their content to optimize for AI discoverability and make informed decisions about bot access.

---

## 3. Goals

- Provide visibility into AI crawler activity on user websites
- Identify and categorize known AI bots by platform
- Track which pages AI crawlers visit most frequently
- Enable CSV export for reporting

---

## 4. User Stories

**US-1:** As a website owner, I want to see which AI platforms are crawling my site so I can understand my AI visibility.

**US-2:** As an SEO professional, I want to know which pages AI crawlers visit most so I can optimize high-value content.

**US-3:** As a content strategist, I want to track crawler activity over time so I can identify trends.

**US-4:** As a website administrator, I want to easily install a tracking pixel so I can start collecting data quickly.

**US-5:** As a marketing manager, I want to export crawler data as CSV for reports.

---

## 5. Functional Requirements

### 5.1 Tracking Pixel

| ID | Requirement |
|----|-------------|
| FR-1.1 | Lightweight JavaScript snippet (< 5KB) users embed on their website |
| FR-1.2 | Capture user agent strings and identify known AI crawler signatures |
| FR-1.3 | Record page URL, timestamp, and anonymized IP for each crawler visit |
| FR-1.4 | Async loading to minimize page performance impact |

### 5.2 Bot Detection & Classification

| ID | Requirement |
|----|-------------|
| FR-2.1 | Maintain list of known AI crawler user agent patterns |
| FR-2.2 | Classify crawlers by platform: OpenAI, Anthropic, Google, Perplexity, Meta, etc. |
| FR-2.3 | Categorize bot types: AI Training, AI Search, AI Assistant |
| FR-2.4 | Flag unknown bots as "Unknown" |

### 5.3 Analytics Dashboard

| ID | Requirement |
|----|-------------|
| FR-3.1 | Display total crawler visits over time periods (24h, 7d, 30d) |
| FR-3.2 | Show breakdown of visits by AI platform with charts |
| FR-3.3 | List top pages visited by crawlers with visit counts |
| FR-3.4 | Display crawler activity timeline/trend chart |
| FR-3.5 | Filter by bot type, platform, and date range |
| FR-3.6 | Show recent crawler activity log |

### 5.4 Data Export

| ID | Requirement |
|----|-------------|
| FR-4.1 | Export crawler data as CSV with all fields |

---

## 6. Technical Architecture

### 6.1 System Components

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Tracking Pixel │────▶│ Supabase Edge   │────▶│    Supabase     │
│   (JS SDK)      │     │    Function     │     │    Postgres     │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ┌─────────────────┐              │
                        │  Next.js App    │◀─────────────┘
                        │  (Dashboard)    │
                        └─────────────────┘
```

| Component | Description |
|-----------|-------------|
| **Tracking Pixel** | JavaScript snippet that captures user agent, URL, timestamp and POSTs to Supabase Edge Function |
| **Supabase Edge Function** | Receives beacon, classifies bot, inserts into Postgres |
| **Supabase Postgres** | Stores all crawler events and site configuration |
| **Supabase Auth** | Handles user authentication |
| **Next.js Dashboard** | Frontend displaying analytics, charts, and CSV export |

### 6.2 Known AI Crawler User Agents

| Platform | User Agent | Purpose |
|----------|------------|---------|
| OpenAI | `GPTBot` | AI Training & Search |
| OpenAI | `ChatGPT-User` | Real-time browsing |
| OpenAI | `OAI-SearchBot` | SearchGPT |
| Anthropic | `ClaudeBot` | AI Training |
| Google | `Google-Extended` | Gemini Training |
| Perplexity | `PerplexityBot` | AI Search |
| Meta | `Meta-ExternalAgent` | AI Training |
| Apple | `Applebot-Extended` | AI Features |
| Common Crawl | `CCBot` | Dataset Building |
| Bytedance | `Bytespider` | AI Training |

### 6.3 Supabase Schema

```sql
-- Sites table
CREATE TABLE sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    domain TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Crawler events table
CREATE TABLE crawler_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES sites(id),
    timestamp TIMESTAMP DEFAULT NOW(),
    user_agent TEXT NOT NULL,
    bot_name VARCHAR(100),
    platform VARCHAR(50),
    bot_type VARCHAR(20), -- 'training', 'search', 'assistant', 'unknown'
    page_url TEXT NOT NULL,
    page_path VARCHAR(500),
    ip_hash VARCHAR(64)
);

-- Indexes for fast queries
CREATE INDEX idx_events_site_time ON crawler_events(site_id, timestamp DESC);
CREATE INDEX idx_events_platform ON crawler_events(platform);

-- RLS policies
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawler_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sites" ON sites
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own events" ON crawler_events
    FOR SELECT USING (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));
```

### 6.4 Bot Classification Logic

```javascript
const BOT_PATTERNS = [
  { pattern: /GPTBot/i, name: 'GPTBot', platform: 'OpenAI', type: 'training' },
  { pattern: /ChatGPT-User/i, name: 'ChatGPT-User', platform: 'OpenAI', type: 'assistant' },
  { pattern: /OAI-SearchBot/i, name: 'OAI-SearchBot', platform: 'OpenAI', type: 'search' },
  { pattern: /ClaudeBot/i, name: 'ClaudeBot', platform: 'Anthropic', type: 'training' },
  { pattern: /Claude-Web/i, name: 'Claude-Web', platform: 'Anthropic', type: 'assistant' },
  { pattern: /Google-Extended/i, name: 'Google-Extended', platform: 'Google', type: 'training' },
  { pattern: /PerplexityBot/i, name: 'PerplexityBot', platform: 'Perplexity', type: 'search' },
  { pattern: /Meta-ExternalAgent/i, name: 'Meta-ExternalAgent', platform: 'Meta', type: 'training' },
  { pattern: /Applebot-Extended/i, name: 'Applebot-Extended', platform: 'Apple', type: 'training' },
  { pattern: /CCBot/i, name: 'CCBot', platform: 'Common Crawl', type: 'training' },
  { pattern: /Bytespider/i, name: 'Bytespider', platform: 'Bytedance', type: 'training' },
];

function classifyBot(userAgent) {
  for (const bot of BOT_PATTERNS) {
    if (bot.pattern.test(userAgent)) {
      return { name: bot.name, platform: bot.platform, type: bot.type };
    }
  }
  return { name: 'Unknown', platform: 'Unknown', type: 'unknown' };
}
```

---

## 7. UI/UX Requirements

### 7.1 Dashboard Views

1. **Overview** - Total visits, active bots count, top platform, top page
2. **Platforms** - Bar/pie chart breakdown by AI platform
3. **Pages** - Table of pages ranked by crawler visits
4. **Activity Log** - Recent crawler events with filters
5. **Settings** - Tracking code snippet, CSV export button

### 7.2 Installation Flow

```
1. User signs up via Supabase Auth
           ↓
2. User adds website domain
           ↓
3. System generates tracking code with site_id
           ↓
4. User copies code into website <head>
           ↓
5. Data appears in dashboard
```

### 7.3 Tracking Code Example

```html
<script>
(function(s,i,t,e){
  var d=document,g=d.createElement('script');
  g.async=1;g.src='https://yourapp.supabase.co/functions/v1/track?sid='+s;
  d.head.appendChild(g);
})('SITE_ID_HERE');
</script>
```

---

## 8. Acceptance Criteria

| # | Criteria |
|---|----------|
| AC-1 | Tracking pixel detects GPTBot, ClaudeBot, PerplexityBot, Google-Extended |
| AC-2 | Dashboard displays crawler visits grouped by platform |
| AC-3 | Top pages report ranks pages by crawler visit count |
| AC-4 | Date range filtering works on dashboard |
| AC-5 | CSV export downloads all crawler data |
| AC-6 | User can install tracking code in < 5 minutes |

---

## 9. Timeline (2 Days)

| Day | Tasks |
|-----|-------|
| **Day 1 (Morning)** | Supabase setup: schema, RLS policies, Edge Function for tracking |
| **Day 1 (Afternoon)** | Tracking pixel JS, bot classification logic, test ingestion |
| **Day 2 (Morning)** | Dashboard UI: overview stats, platform chart, pages table |
| **Day 2 (Afternoon)** | Activity log, date filters, CSV export, testing & polish |

### Detailed Breakdown

**Day 1:**
- [ ] Create Supabase project
- [ ] Set up database schema (sites, crawler_events)
- [ ] Configure RLS policies
- [ ] Build Edge Function for tracking endpoint
- [ ] Implement bot classification logic
- [ ] Create tracking pixel JavaScript
- [ ] Test end-to-end data flow

**Day 2:**
- [ ] Set up Next.js app with Supabase client
- [ ] Build auth flow (sign up/login)
- [ ] Create dashboard layout
- [ ] Build overview stats component
- [ ] Build platform breakdown chart
- [ ] Build top pages table
- [ ] Build activity log with filters
- [ ] Implement CSV export
- [ ] Testing and bug fixes

---

## 10. Out of Scope

- REST API endpoints
- Webhook notifications
- Real-time alerts
- Bot blocking features
- Server log file analysis
- Team/multi-user features
- Custom date ranges beyond presets

---

## 11. Risks

| Risk | Mitigation |
|------|------------|
| AI bots may not execute JavaScript | Document limitation; server-side tracking is v2 |
| Bot signatures change | Use regex patterns that match partial strings |
| High volume sites | Supabase free tier limits; upgrade path documented |

---

## 12. Appendix

### CSV Export Format

```csv
timestamp,page_url,bot_name,platform,bot_type,user_agent
2026-01-31T10:23:45Z,/blog/post-1,GPTBot,OpenAI,training,"Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko)..."
2026-01-31T10:24:12Z,/docs/api,ClaudeBot,Anthropic,training,"ClaudeBot/1.0..."
```

### Reference

- [Trakkr AI Crawlers](https://trakkr.ai/learn/docs/features/ai-crawlers)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Dark Visitors Bot List](https://darkvisitors.com)
