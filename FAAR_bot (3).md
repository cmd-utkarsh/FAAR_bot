# FAAR_bot — FrontApp Auto-Reply Bot

**Full name:** FrontApp Auto-Reply Bot (FAAR_bot)
**Type:** Internal Ops Tool — Full-Stack Web Dashboard + Automated Email Reply Pipeline for RoadReady
**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui · Node.js · DeepSeek API · Front Core API
**No Auth Required** (internal tool, single operator)

---

## 0. What Changed In This Revision

This draft was checked line-by-line against Front's live API reference (`dev.frontapp.com`) on 2026-06-30. Five things in the original plan don't match how Front's API actually works, and they change the design meaningfully:

1. **There is no `"waiting"` value you can PATCH onto a conversation.** The `status` field only accepts `archived | open | deleted | spam`. "Waiting" is a *ticket status category* that only exists if **Ticketing** is enabled on your Front workspace, and you set it via `status_id` (a specific status ID), not `status`. See §4.1 and §4.6 — this is the single most important correction.
2. **Webhooks turned out to be the wrong tool for how this will actually be used, so this build skips them entirely.** Front webhooks aren't registered via any API call anyway (no `POST /webhooks` endpoint exists) — they're UI-configured Rules or Apps that run whether or not you're watching. Since the operator only wants the bot active while supervising it, live mode is built as on-demand **polling** instead. See §4.4 and §11 Phase 4.
3. **Front's rate limit is 50–200 requests per *minute*, not per second**, and it's enforced per-company, not per-token. The original "10 concurrent, 200ms delay" sweep design would get you 429'd almost immediately. This changes the bulk-sweep runtime from "minutes" to "hours, possibly spread over more than one day." See §12.
4. **The reply-send endpoint archives the conversation by default** (`options.archive: true`), is asynchronous (returns `202 Accepted` with a `message_uid`, not the sent message), and message template IDs are prefixed `rsp_`, not `msg_tmpl_`. See §4.2–4.3.
5. **Message template variables (`{{recipient.first_name}}` etc.) are resolved by Front's composer/Rules engine, not by the raw Core API.** If your templates contain merge variables, the API will hand you the raw, unresolved body — your pipeline needs to do the substitution itself before sending. See §4.3.

Everything below reflects the corrected behavior. Section §0.1 lists the things you need to verify in your own Front workspace before writing code.

### 0.1 Verify before building

- [Y] **Is Ticketing enabled?** Go to a conversation in Front and check whether you can pick a custom status (e.g. "Waiting on Customer") beyond just Open/Archived. Your manual workflow description ("sending as Waiting") strongly suggests yes — but confirm, because the whole status-update step depends on it.
- [Professional ] **Which Front plan are you on** (Starter / Professional / Enterprise)? This sets your rate limit ceiling (50 / 100 / 200 requests per minute) and directly determines how long the 7,000-email sweep will take.
- [ ] **Decide a default poll interval** for Live Check mode (default 45s recommended — see §11 Phase 4). Nothing to set up on the Front side; this is purely a setting in your own app.

---

## 1. Project Overview

FAAR_bot is an internal dashboard that automates triaging and replying to RoadReady support emails received via Front. Instead of manually copying each email into an AI chat, selecting a template, and sending a reply, this tool builds a pipeline that:

1. Fetches open/unresolved conversations from Front via the Core API
2. Sends each email's content to DeepSeek via the DeepSeek API, which selects the best-matching message template and returns a confidence score
3. Presents a review dashboard with matched templates, scores, and reply previews
4. Auto-sends replies above a configurable confidence threshold via the Front API, and sets the conversation to the workspace's "Waiting" ticket status (if Ticketing is enabled) — or queues low-confidence matches for manual review

The system is designed to work through a backlog of ~9,000 conversations in a throttled, resumable batch job. After that, it's used in short supervised sessions: you turn it on, it polls Front for new mail and processes it while you watch, and you turn it off when you're done — there's no always-on background listener.

---

## 2. Core Concepts

### Confidence Score
Every template match produced by DeepSeek is accompanied by a **confidence score (0–100)**. This score reflects how well the selected template addresses the intent of the email. The operator configures a threshold (default: 85). Emails above threshold are auto-sent; below threshold are flagged for manual review.

### Processing Modes
- **Bulk Sweep Mode:** One-time paginated pull of all open conversations, run as a long-lived, resumable background job — throttled to a safe fraction of Front's per-minute rate limit (see §12), not a fixed concurrency count. Used for the 7,000-email backlog.
- **Live Polling Mode:** A manual "Live Check" toggle on the dashboard, on only while you're supervising it. While on, the app polls `GET /conversations` on an interval (default 45s), diffs against `ProcessLog` to find conversations it hasn't seen, and runs them through the same pipeline as the bulk sweep. Turning it off is just flipping a boolean in your own app — nothing needs to be registered or unregistered on Front's side. See §11 Phase 4 for why this replaced a webhook design.

### Conversation Status After Reply
This depends on whether Ticketing is enabled on your workspace:
- **Ticketing enabled (your case, most likely):** `PATCH /conversations/{id}` with `{"status_id": "<id of your 'Waiting' status>"}`. The status ID is workspace-specific and must be looked up once via `GET /company/statuses` (§4.6) — it is **not** the literal string `"waiting"`.
- **Ticketing not enabled:** there is no "Waiting" state to set. The closest equivalent is to send the reply without archiving (`options.archive: false`) so the conversation stays **Open** and visible in the team inbox, exactly like before any reply was sent. Flag this clearly in Settings so the operator knows which mode the bot is in.

---

## 3. Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 15 (App Router), React 19 | Full-stack framework, SSR, routing |
| Styling | Tailwind CSS v4, shadcn/ui | UI components and design system |
| Language | TypeScript (strict mode) | End-to-end type safety |
| LLM | DeepSeek DeepSeek (Haiku 4.5 default, Sonnet 4.6 fallback) or DeepSeek V3 | Template selection + confidence scoring |
| Email Platform | Front Core API (REST) | Fetch conversations, send replies, update status |
| Database | PostgreSQL (via Railway) | Logs — processed conversations, scores, template used, status |
| ORM | Prisma v6 | Type-safe DB queries |
| Deployment | Railway (backend + DB) or Vercel (frontend) | Hosting |
| Live Mode | Client-side polling interval + `/api/live-check` route | Manually-toggled on-demand checking, no always-on listener |
| Queue / Rate Limiter | Custom token-bucket throttle keyed to Front's `x-ratelimit-*` headers | Stay under Front's per-minute company-wide limit |

> Note on hosting: a serverless platform (Vercel) will time out long-running bulk-sweep requests. Run the bulk sweep as a background worker on Railway (a long-lived Node process or a cron-triggered job), not as a single HTTP request handler.

---

## 4. Front Core API Reference (verified against dev.frontapp.com)

All API calls use base URL `https://api2.frontapp.com` with header:
```
Authorization: Bearer <FRONT_API_TOKEN>
Content-Type: application/json
```

### 4.1 Conversations

| Method | Endpoint | Scope required | Description |
|---|---|---|---|
| `GET` | `/conversations` | `conversations:read` | List conversations, paginated, most-recently-updated first |
| `GET` | `/conversations/{conversation_id}` | `conversations:read` | Get a single conversation |
| `PATCH` | `/conversations/{conversation_id}` | `conversations:write` | Update conversation status, assignee, tags, inbox, custom fields |

**Filtering uses the bracketed `q[...]` query object, not flat query params.** Front's docs show two filter shapes depending on whether Ticketing is enabled:

```
# Without Ticketing — filter by the 4 base statuses (repeat the param for an OR list)
GET /conversations?q[statuses]=unassigned&q[statuses]=assigned&limit=100

# With Ticketing enabled — filter by status category instead
GET /conversations?q[status_categories]=open&limit=100
```

Pagination: each response includes `_pagination.next`, a full URL containing a `page_token` — follow that URL directly rather than constructing your own. `limit` maxes out at 100.

**Update conversation status (PATCH body):**
```json
{ "status": "archived" }
```
Allowed values for the plain `status` field: **`archived`, `open`, `deleted`, `spam`** — there is no `"waiting"` option here. To set a Ticketing-managed status (including "Waiting"), use `status_id` instead, and don't send both in the same request:
```json
{ "status_id": "sts_5z" }
```
(`sts_5z` is just an example — fetch your workspace's real status IDs per §4.6.)

The response to a successful PATCH is `204 No Content`. A `301` means the conversation was merged into another one — follow the redirect.

### 4.2 Messages

| Method | Endpoint | Scope required | Description |
|---|---|---|---|
| `GET` | `/conversations/{conversation_id}/messages` | `messages:read` | List messages in a conversation, newest first |
| `POST` | `/conversations/{conversation_id}/messages` | `messages:send` | Reply to a conversation (this is a distinct scope from `conversations:write` — make sure your API token has **Send** checked, not just Write) |

**Reading messages** — the field that tells you direction is `is_inbound` (boolean), not `direction`:
```json
{
  "id": "msg_1q15qmtq",
  "type": "email",
  "is_inbound": true,
  "subject": "Refund request",
  "body": "<p>...</p>",
  "text": "...",
  "created_at": 1701292639
}
```

**Sending a reply — request body:**
```json
{
  "body": "<p>Template content here</p>",
  "author_id": "tea_6r55a",
  "options": {
    "archive": false
  }
}
```
Important details that differ from a naive read of the endpoint name:
- `options.archive` **defaults to `true`**. If you don't explicitly pass `false`, Front will archive the conversation the instant the reply sends — before your follow-up `PATCH` to set the Waiting status even has a chance to matter. Always send `archive: false` explicitly, then do the status PATCH as a separate step.
- The response is `202 Accepted`, not `200`, and the body is `{"status": "accepted", "message_uid": "..."}` — **not the full sent message**. Sending is asynchronous on Front's side. Log the `message_uid` for traceability; don't assume the message is delivered the instant you get the 202.
- `author_id` (a teammate ID) is optional but recommended — without it, the message may not have a clear "sent by" attribution in Front's UI. You'll need a dedicated teammate or bot identity's `tea_...` ID.
- `channel_id` is optional unless the conversation spans multiple channels.

### 4.3 Message Templates

| Method | Endpoint | Scope required | Description |
|---|---|---|---|
| `GET` | `/message_templates` | `message_templates:read` | List all available message templates |
| `GET` | `/message_templates/{message_template_id}` | `message_templates:read` | Get a specific template |

**Template object shape (actual schema):**
```json
{
  "id": "rsp_16yc",
  "name": "Refund Request Response",
  "subject": "Re: Your refund request",
  "body": "<div><p>Hi {{recipient.first_name}},...</p></div>",
  "attachments": [],
  "is_available_for_all_inboxes": true,
  "inbox_ids": null
}
```
Two corrections from the original draft:
- The ID prefix is **`rsp_`**, not `msg_tmpl_`.
- **If your templates use `{{...}}` merge variables** (e.g. `{{recipient.first_name}}`), be aware that variable resolution is a feature of Front's *composer UI and Rules engine* — when you fetch a template's `body` through this raw Core API endpoint, you get the literal unresolved text. Your pipeline (`lib/templates.ts`) needs to do its own substitution (pull the recipient's name/handle from the conversation object and string-replace) before calling the send endpoint. Test this once against your real templates before assuming either way — Front's docs don't explicitly state the Core API's behavior here, only the composer/Rules behavior.

### 4.4 Webhooks (evaluated, not used in this build)

The original plan assumed `POST /webhooks`, `GET /webhooks`, `DELETE /webhooks/{id}` existed as Core API calls. **They don't.** Front offers two webhook mechanisms, and both are configured entirely through the Front UI, not the API:

- **Rule webhooks** — set up in Settings → Rules, signed with `X-Front-Signature` (HMAC-SHA1 of the raw body, keyed with an API Secret from the "Webhooks" App Store app). No retries; 5-second timeout.
- **Application webhooks** — set up by creating a Front "App" under Settings → Developers, with a one-time challenge-response validation step and HMAC-SHA256 signatures. Retries up to 3 times, then auto-disables.

Both options run unattended whether or not you're watching, which is the opposite of how this tool is actually used (turned on only while supervising). Worth knowing if you ever do want a dashboard "enable/disable live mode" toggle: it can't reach into Front's side at all — **the Core API only exposes read access to Rules** (`GET /rules`, `GET /rules/{id}`, scope `rules:read`; no create/update/delete/enable endpoints exist). So a Rule, once created in the Front UI, keeps firing regardless of any state in your dashboard — a toggle could only make your own server ignore incoming events, meaning the server still has to be up and reachable the whole time anyway, which defeats the point. That's the deciding factor, on top of the supervised-use case, for going with polling instead — see §11 Phase 4 for the design actually used.

### 4.5 Inboxes

| Method | Endpoint | Scope required | Description |
|---|---|---|---|
| `GET` | `/inboxes` | `inboxes:read` | List all inboxes — used to scope your queries/token to the right inbox |
| `GET` | `/inboxes/{inbox_id}/conversations` | `conversations:read` | List conversations within a specific inbox |

### 4.6 Ticket Statuses (new section — required for "Waiting" to work)

| Method | Endpoint | Scope required | Description |
|---|---|---|---|
| `GET` | `/company/statuses` | `statuses:read` | List your workspace's custom ticket statuses (returns `404` if Ticketing isn't enabled) |

```json
{
  "_results": [
    { "id": "sts_1a", "name": "Open", "category": "open" },
    { "id": "sts_5z", "name": "Waiting on Customer", "category": "waiting" },
    { "id": "sts_9k", "name": "Resolved", "category": "resolved" }
  ]
}
```
Run this once at setup, find the entry whose `category` is `"waiting"`, and store its `id` as `FRONT_WAITING_STATUS_ID`. Don't hardcode the name — your workspace might call it something other than "Waiting."

---

## 5. DeepSeek API Reference

**Base URL:** `https://api.deepseek.com/chat/completions`

**Headers**
```http
Authorization: Bearer <DEEPSEEK_API_KEY>
Content-Type: application/json
```

### Request Format

The application sends the latest inbound email together with all available response templates. DeepSeek must return **only JSON** selecting the most appropriate template.

**Recommended model:** `deepseek-chat`

**Optional fallback:** `deepseek-reasoner` for difficult or ambiguous emails.

Example request:

```json
{
  "model": "deepseek-chat",
  "response_format": {
    "type": "json_object"
  },
  "messages": [
    {
      "role": "system",
      "content": "You are a RoadReady customer support routing assistant. Return ONLY valid JSON."
    },
    {
      "role": "user",
      "content": "INBOUND EMAIL:\n...\n\nAVAILABLE TEMPLATES:\n..."
    }
  ],
  "temperature": 0
}
```

Expected response:

```json
{
  "template_id": "rsp_xxxxx",
  "template_name": "Refund Request Response",
  "confidence": 94,
  "reasoning": "Customer is requesting a refund."
}
```

The backend validates the JSON response before continuing the pipeline. Invalid or missing JSON automatically routes the conversation to Manual Review.


---

## 6. System Architecture

```
FRONT INBOX
     │
     ├── Bulk Sweep (one-time, resumable)
     │     GET /conversations?q[statuses]=unassigned&q[statuses]=assigned (paginated)
     │     ↓
     │   [Token-bucket throttle keyed to x-ratelimit-remaining / x-ratelimit-reset —
     │    NOT a fixed concurrency count. See §12.]
     │
     └── Live Check (manual toggle, on only while you're watching)
           Client polls /api/live-check every N seconds while toggle is on
                    │
                    ▼
          GET /conversations?q[statuses]=unassigned&q[statuses]=assigned&limit=25
                    │
                    ▼
          Diff against ProcessLog → new conversation_ids only
                    │
                    ▼
          GET /conversations/{id}/messages  (fetch last message where is_inbound === true)
                    │
                    ▼
          GET /message_templates            (fetch all templates — cached 5min)
                    │
                    ▼
          DeepSeek API
          → template_id, confidence, reasoning
                    │
              ┌─────┴──────┐
         ≥ threshold    < threshold
              │               │
              ▼               ▼
      POST /conversations/{id}/messages   Flag for manual
      { body, author_id,                  review in dashboard
        options: { archive: false } }
      → 202 Accepted, message_uid
              │
              ▼
      PATCH /conversations/{id}
      { status_id: FRONT_WAITING_STATUS_ID }   (Ticketing enabled)
      — or —
      (leave status as-is / "open")            (Ticketing not enabled)
              │
              ▼
      INSERT into ProcessLog DB table
      (conv_id, template_id, confidence, status, message_uid, timestamp)
```

---

## 7. Database Schema

```prisma
// prisma/schema.prisma

model ProcessLog {
  id               String    @id @default(cuid())
  conversationId   String    @unique
  subjectLine      String?
  emailSnippet     String    @db.Text
  selectedTemplate String
  templateId       String
  confidence       Int
  reasoning        String    @db.Text
  messageUid       String?   // Front's async send identifier, for traceability
  statusIdApplied  String?   // which Front status_id was set, if any (Ticketing mode)
  status           LogStatus @default(PENDING)
  replySentAt      DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
}

enum LogStatus {
  AUTO_SENT       // confidence >= threshold, reply sent
  MANUAL_REVIEW   // confidence < threshold, awaiting human
  MANUALLY_SENT   // was in review, operator approved and sent
  SKIPPED         // operator chose to skip
  ERROR           // API failure
}
```

---

## 8. Project Structure

```
faar-bot/
├── app/
│   ├── layout.tsx                  ← Root layout, no auth wrapper
│   ├── page.tsx                    ← Redirect to /dashboard
│   ├── dashboard/
│   │   ├── page.tsx                ← Main dashboard (stats + conversation table)
│   │   └── [id]/
│   │       └── page.tsx            ← Single conversation detail + manual reply
│   ├── bulk/
│   │   └── page.tsx                ← Bulk sweep control panel
│   └── settings/
│       └── page.tsx                ← Threshold config, API token status, Ticketing mode indicator
│
├── api/
│   ├── process/route.ts            ← POST — process a single conversation
│   ├── bulk/route.ts               ← POST — trigger/resume bulk sweep job
│   ├── reply/route.ts              ← POST — send approved manual reply
│   ├── templates/route.ts          ← GET — fetch + cache Front templates
│   └── live-check/route.ts         ← GET — list unseen new conversations + process them; called by the polling hook
│
├── components/
│   ├── dashboard/
│   │   ├── StatsBar.tsx
│   │   ├── ConversationTable.tsx
│   │   ├── ConfidenceBadge.tsx
│   │   ├── BulkProgress.tsx
│   │   └── LiveCheckToggle.tsx     ← On/off switch + "last checked" timestamp + poll-interval control
│   ├── conversation/
│   │   ├── EmailPreview.tsx
│   │   ├── TemplatePreview.tsx
│   │   └── ActionButtons.tsx
│   └── ui/                         ← shadcn/ui components
│
├── hooks/
│   └── useLiveCheck.ts             ← Client-side interval that calls /api/live-check while toggle is on; stops on unmount or toggle-off
│
├── lib/
│   ├── front.ts                    ← Front API client (typed fetch wrappers)
│   ├── deepseek.ts                   ← DeepSeek API call + response parser
│   ├── templates.ts                ← Template fetcher + variable-substitution helper, in-memory cache
│   ├── pipeline.ts                 ← Core: fetch → analyze → send → log
│   ├── rate-limiter.ts             ← Token-bucket throttle reading Front's x-ratelimit-* headers
│   └── db.ts                       ← Prisma client singleton
│
├── prisma/
│   └── schema.prisma
│
├── types/
│   └── index.ts
│
├── .env.local
└── next.config.ts
```

---

## 9. UI Components & Dashboard Design

### 9.1 Stats Bar (Top KPIs)
- **Total Processed** — running count of conversations handled
- **Auto-Sent** — count + percentage above threshold
- **Pending Review** — count of flagged conversations
- **Errors** — failed API calls

### 9.2 Conversation Table

| Column | Description |
|---|---|
| Subject | Email subject line (truncated) |
| From | Sender email or name |
| Template Selected | Template name DeepSeek matched |
| Confidence | Color-coded badge: green ≥85, amber 60–84, red <60 |
| Status | Chip: AUTO_SENT / REVIEW / SENT / SKIPPED / ERROR |
| Time | Relative timestamp |
| Actions | View · Approve · Skip (visible for REVIEW status only) |

### 9.3 Conversation Detail Panel
Slide-over panel (or dedicated route `/dashboard/[id]`) showing the full inbound email body, DeepSeek's reasoning text, the selected template preview (with any unresolved `{{variable}}` placeholders highlighted in red so the operator can spot a substitution bug before sending), a confidence score gauge, and **Send Reply** / **Re-analyze** / **Skip** buttons.

### 9.4 Bulk Sweep Control Page (`/bulk`)
- Start/Resume Sweep button with progress bar (X of 7000 processed) — must support resuming from where it left off, since at realistic rate limits this will span multiple sessions
- Estimated time remaining, computed from the live `x-ratelimit-remaining`/`x-ratelimit-reset` headers, not a hardcoded assumption
- Live log stream (SSE or polling) showing last 20 processed entries
- Pause / Resume toggle
- Dry Run mode toggle (analyze but do not send)

### 9.5 Settings Page (`/settings`)
- Confidence threshold slider (default 85, range 50–99)
- API token status indicators (Front token: ✅ valid / ❌ invalid, DeepSeek key status)
- **Ticketing mode indicator** — shows whether `FRONT_WAITING_STATUS_ID` resolved successfully, and what happens to conversations after auto-send if it didn't (left Open vs. archived)
- Model selector (deepseek-chat vs deepseek-reasoner)
- Poll interval control for Live Check mode (seconds — default 45)

### 9.6 Live Check Control (top of `/dashboard`)
A single toggle, visible wherever the operator spends time, not buried in Settings:
- **On/Off switch** — flipping it starts/stops the client-side polling interval (`useLiveCheck`). No Front-side state to keep in sync, since nothing is registered on Front's end (see §4.4) — this is purely local app state.
- **"Last checked"** timestamp, refreshed every poll
- **New this session** counter — how many conversations the current Live Check session has processed
- Same Dry Run toggle available on the bulk page applies here too, so you can watch a session's matches before trusting it to auto-send

---

## 10. Environment Variables

```bash
# .env.local

# Front API
FRONT_API_TOKEN=your_bearer_token_here
FRONT_WAITING_STATUS_ID=        # from GET /company/statuses where category == "waiting"; leave blank if Ticketing isn't enabled
FRONT_AUTHOR_TEAMMATE_ID=       # tea_... id the bot sends replies "on behalf of"

# DeepSeek
DEEPSEEK_API_KEY=sk-ant-...

# Database (Railway PostgreSQL)
DATABASE_URL=postgresql://user:pass@host:5432/faar_bot

# App
NEXT_PUBLIC_APP_URL=https://your-app.railway.app
CONFIDENCE_THRESHOLD=85
FRONT_PLAN_RATE_LIMIT_RPM=100   # 50 (Starter) / 100 (Professional) / 200 (Enterprise) — confirm with your Front plan
LIVE_CHECK_POLL_INTERVAL_SECONDS=45   # how often the Live Check toggle polls GET /conversations while it's on
```

---

## 11. Phase-by-Phase Implementation Plan

### Phase 1 — Foundation & API Wiring (Days 1–2)

**Goal:** Prove the core pipeline works end-to-end in a script before building any UI.

- [ ] Scaffold Next.js 15 project with TypeScript + Tailwind + shadcn/ui
- [ ] Set up PostgreSQL on Railway + Prisma schema + migrations
- [ ] Run `GET /company/statuses` once manually (curl/Postman) to confirm whether Ticketing is enabled and capture the "waiting"-category status ID
- [ ] Write `lib/front.ts` — typed wrappers for:
  - `GET /conversations` (with `q[...]` filters + `_pagination.next` following)
  - `GET /conversations/{id}/messages`
  - `GET /message_templates`
  - `POST /conversations/{id}/messages` (always passing `options.archive: false`)
  - `PATCH /conversations/{id}` (status or status_id update)
- [ ] Write `lib/deepseek.ts` — DeepSeek API call with structured JSON output
- [ ] Write `lib/templates.ts` — template cache + `{{variable}}` substitution helper; test it against 2–3 real templates to confirm whether raw API bodies come back resolved or not
- [ ] Write `lib/pipeline.ts` — single conversation processor function
- [ ] Write a CLI test script (`scripts/test-pipeline.ts`) that:
  1. Fetches 5 open conversations
  2. Runs DeepSeek on each
  3. Logs template match + confidence to console
  4. Does NOT send (dry run)
- [ ] Verify API token scopes: `conversations:read`, `conversations:write`, `messages:read`, `messages:send`, `message_templates:read`, `statuses:read` are all granted (Front UI groups these under Read/Write/Send checkboxes when creating the token)

**Deliverable:** Console output showing conversation → template → confidence for 5 real emails.

---

### Phase 2 — Bulk Sweep Engine (Days 3–5)

**Goal:** Process the full 7,000 backlog reliably, within Front's actual rate limits.

- [ ] Write `lib/rate-limiter.ts` — a token-bucket throttle that reads `x-ratelimit-remaining` and `x-ratelimit-reset` from every Front response and paces requests to stay under `FRONT_PLAN_RATE_LIMIT_RPM` (target ~80% of the limit to leave headroom for dashboard usage happening concurrently)
- [ ] Add retry logic honoring the `retry-after` header on `429` responses — don't use a fixed backoff guess
- [ ] Implement dry-run mode flag (process + log, skip the actual `POST /messages`)
- [ ] Build `api/bulk/route.ts` as a job-trigger endpoint that kicks off (or resumes) a background worker process — not a single long HTTP request, since this will run for hours
- [ ] Make the sweep resumable: track the last successfully processed conversation/page token in the DB so a restart picks up where it left off
- [ ] Write all results to `ProcessLog` table in DB (template, confidence, status, message_uid)
- [ ] Add `BULK_JOB_RUNNING` flag to prevent concurrent sweeps

**Deliverable:** Running the bulk job processes all conversations, respects Front's real rate limit, survives a restart, and logs results. Zero emails sent in dry-run.

> Budget reality check: at ~3 Front API calls per conversation (list messages, send reply, patch status — template list is cached), 7,000 conversations is roughly 21,000 calls. At Professional-tier 100 rpm with 20% headroom held back, that's ~260 minutes (~4.5 hours) of pure API time at minimum, likely more once you factor in the initial paginated listing calls and any 429 backoffs. Plan for the sweep to run unattended over several hours, not in one sitting.

---

### Phase 3 — Dashboard UI (Days 6–8)

**Goal:** Review interface to see what happened and handle flagged emails.

- [ ] Build root layout: sidebar nav (Dashboard, Bulk, Settings) + topbar
- [ ] `StatsBar.tsx` — 4 KPI cards pulling from `ProcessLog` DB aggregates
- [ ] `ConversationTable.tsx` — paginated table with sorting, status filter, search by subject
- [ ] `ConfidenceBadge.tsx` — green/amber/red color-coded confidence chip
- [ ] Conversation detail page `/dashboard/[id]`:
  - Fetch conversation from Front API live
  - Show inbound email + DeepSeek reasoning + template preview (with unresolved `{{variables}}` flagged)
  - Action buttons: Approve (send + set status), Skip, Re-analyze
- [ ] Wire `api/reply/route.ts` — executes the POST + PATCH flow
- [ ] Wire `api/process/route.ts` — re-runs DeepSeek on a single conversation

**Deliverable:** Usable dashboard — operator can review all flagged emails, approve and send, or skip.

---

### Phase 4 — Live Polling Mode (Day 9)

**Goal:** Let the operator turn the bot on while supervising it and have it catch new mail without standing up always-on webhook infrastructure.

Webhooks were evaluated and dropped for this build (§4.4) — two reasons: the actual usage pattern is "on only while I'm watching," which is the opposite of what a webhook is for, and a dashboard on/off toggle couldn't have controlled the Front side anyway, since the Core API only exposes read access to Rules. Polling reuses the same `processConversation()` function from Phase 1 with no new Front-side setup.

- [ ] Build `api/live-check/route.ts`:
  - `GET /conversations?q[statuses]=unassigned&q[statuses]=assigned&limit=25` (or your Ticketing-mode equivalent, `q[status_categories]=open`)
  - Diff the returned conversation IDs against `ProcessLog` — skip anything already logged
  - Run `pipeline.processConversation(id)` on each new one, respecting the existing confidence threshold and dry-run flag
  - Return a summary (`{ checked: n, new: n, sent: n, flagged: n }`) for the UI to display
- [ ] Build `hooks/useLiveCheck.ts` — a client-side interval (default `LIVE_CHECK_POLL_INTERVAL_SECONDS`) that calls `/api/live-check` only while the toggle is on, and stops cleanly on toggle-off or page unmount
- [ ] Build `components/dashboard/LiveCheckToggle.tsx` — on/off switch, last-checked timestamp, new-this-session counter
- [ ] No Front-side configuration step at all — confirm this explicitly in a quick test (toggle on, send yourself a test email into the support inbox, watch it get picked up within one poll interval)
- [ ] Add the same deduplication safeguard the bulk sweep uses: `ProcessLog.conversationId` is unique, so even if a poll overlaps with a manual dashboard action on the same conversation, nothing double-sends

**Deliverable:** Flipping the Live Check toggle on processes new mail every `LIVE_CHECK_POLL_INTERVAL_SECONDS` while it's on; flipping it off stops all activity immediately, with nothing left running server-side.

> Cost note: at a 45s interval, that's ~80 `GET /conversations` calls/hour of overhead while Live Check is on — a small fraction of even the Starter-tier 50/minute budget — and you only spend DeepSeek/send-API calls on conversations that are actually new.

---

### Phase 5 — Polish & Observability (Day 10–11)

**Goal:** Make the tool reliable and transparent for day-to-day use.

- [ ] `/bulk` page — progress bar with live SSE stream of processing log, ETA computed from real rate-limit headers
- [ ] Dry Run toggle on bulk page (visible, prominent)
- [ ] Settings page — threshold slider, model picker, API health check buttons, Ticketing-mode indicator
- [ ] Error handling: surface API failures in dashboard with retry option
- [ ] `BulkProgress.tsx` — shows current sweep progress (X/7000, ETA, errors count)
- [ ] Template cache with 5-minute TTL (`lib/templates.ts`) to avoid hammering Front API
- [ ] Export processed log as CSV from dashboard

**Deliverable:** Production-ready internal tool. Operator has full visibility and control.

---

## 12. Front API Rate Limits (corrected)

| Scope | Limit | Notes |
|---|---|---|
| Standard Core API | **50 / 100 / 200 requests per minute** for Starter / Professional / Enterprise plans respectively | Enforced **per company**, not per token — shared with anyone else hitting the Front API on your account |
| `PATCH /conversations/{id}` and `POST /conversations/{id}/messages` | 5 requests/sec **per individual conversation** | A separate, tighter "Tier 2" limit — irrelevant for a single pass over 7,000 distinct conversations, but matters if the same conversation gets multiple rapid webhook events |
| `GET /conversations/search/...` | 40% of your company's standard limit | Proportional limit — avoid using Search for the bulk sweep; use plain `GET /conversations` with `q[...]` filters instead |
| 429 response | Includes `retry-after` header (seconds to wait) | Honor it exactly — repeatedly retrying before the window passes pushes the penalty further out |
| Response headers on every call | `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-reset`, `x-ratelimit-burst-limit`, `x-ratelimit-burst-remaining` | Use these to drive `lib/rate-limiter.ts` instead of a fixed delay constant |

This is the correction with the biggest practical impact: the original plan's "10 concurrent requests with a 200ms delay" implies roughly 50 requests/second, which is **30–120x** over Front's actual per-minute ceiling and would trigger sustained 429s within the first few seconds of a sweep.

---

## 13. Core Pipeline Code Reference

```typescript
// lib/pipeline.ts
import { frontClient } from './front';
import { selectTemplate } from './deepseek';
import { getTemplates, resolveTemplateVariables } from './templates';
import { db } from './db';

export async function processConversation(conversationId: string, dryRun = false) {
  // 1. Fetch the most recent inbound message
  const messages = await frontClient.getMessages(conversationId);
  const lastInbound = messages.find(m => m.is_inbound === true);
  if (!lastInbound) return { skipped: true, reason: 'No inbound message found' };

  // 2. Fetch templates (cached)
  const templates = await getTemplates();

  // 3. Ask DeepSeek to select a template
  const { templateId, templateName, confidence, reasoning } = await selectTemplate(
    lastInbound.body,
    templates
  );

  const threshold = parseInt(process.env.CONFIDENCE_THRESHOLD ?? '85');
  const waitingStatusId = process.env.FRONT_WAITING_STATUS_ID || null;

  let messageUid: string | undefined;
  let statusIdApplied: string | undefined;

  if (!dryRun && confidence >= threshold) {
    const template = templates.find(t => t.id === templateId)!;
    const body = resolveTemplateVariables(template.body, /* conversation context */ lastInbound);

    // 4a. Send reply — archive:false so we control the status transition ourselves
    const sendResult = await frontClient.sendReply(conversationId, {
      body,
      author_id: process.env.FRONT_AUTHOR_TEAMMATE_ID,
      options: { archive: false },
    });
    messageUid = sendResult.message_uid; // 202 Accepted — async, not a guarantee of delivery

    // 4b. Set status — only if Ticketing is enabled and a Waiting status ID was resolved
    if (waitingStatusId) {
      await frontClient.updateConversationStatus(conversationId, { status_id: waitingStatusId });
      statusIdApplied = waitingStatusId;
    }
    // else: leave as-is (archive:false already kept it Open)
  }

  // 5. Log to DB
  await db.processLog.upsert({
    where: { conversationId },
    create: {
      conversationId,
      emailSnippet: lastInbound.body.slice(0, 500),
      selectedTemplate: templateName,
      templateId,
      confidence,
      reasoning,
      messageUid,
      statusIdApplied,
      status: dryRun
        ? 'PENDING'
        : confidence >= threshold ? 'AUTO_SENT' : 'MANUAL_REVIEW',
      replySentAt: (!dryRun && confidence >= threshold) ? new Date() : undefined,
    },
    update: {},
  });

  return { conversationId, confidence, templateName, status: confidence >= threshold ? 'sent' : 'review' };
}
```

---

## 14. What This Project is NOT

- **Not a public-facing app** — no user-facing login, signup, or multi-tenancy
- **Not a chatbot** — no real-time conversation with customers; it selects from fixed templates
- **Not an AI writing tool** — DeepSeek picks templates, it does not generate freeform replies
- **Not a replacement for human judgment** — low-confidence emails always go to manual review
- **Not an always-on background agent** — Live Check only runs while the dashboard toggle is on and someone is supervising it; there's no webhook listener or cron job processing mail while the operator is away
- **Not something that runs in minutes** — the 7,000-email backlog will take hours at minimum given Front's real rate limits; design the bulk sweep as a resumable background job, not a one-shot script
