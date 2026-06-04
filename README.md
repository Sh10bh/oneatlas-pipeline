# OneAtlas Pipeline

AI Engineer trial-task submission. A 3-stage pipeline that converts a plain-English app description into a validated, machine-readable AppSpec — with strict validation, classified repair strategies, multi-provider AI routing, and SSE progress streaming.

**Live frontend:** https://oneatlas-pipeline.vercel.app
**Backend API:** https://oneatlas-pipeline.onrender.com

---

## Architecture

```
Prompt → Intent Extraction → Schema Generation → AppSpec Generation → AppSpec
              ↓                     ↓                    ↓
          Validation            Validation           Validation
              ↓                     ↓                    ↓
         Repair Engine         Repair Engine        Repair Engine
```

Each stage is fully isolated with typed input/output interfaces. The validation layer runs after every stage before output is passed downstream. The repair engine intercepts failures before escalating to a full re-prompt.

### Monorepo Layout

```
apps/
  server/   Express + TypeScript — pipeline, validation, repair, gateway, integrations
  web/      Next.js — prompt input, SSE stage progress, AppSpec output, repair log panel
```

---

## Pipeline Stages

| Stage | Input | Output | Primary Model |
|---|---|---|---|
| Intent Extraction | Raw prompt string | AppIntent | Groq Llama (fast, cheap) |
| Schema Generation | AppIntent | DataSchema | Anthropic Claude Sonnet |
| AppSpec Generation | DataSchema | AppSpec | Anthropic Claude Sonnet |
| Repair prompts | Failed output + errors | Corrected output | Source model first, then escalate |

Model routing is config-driven in `src/config/model-routing.ts` — no hardcoded model names in stage implementations.

---

## Repair Engine

Four classified strategies, applied in order before escalating to a full re-prompt:

| Strategy | Handles |
|---|---|
| `structural_repair` | Malformed or truncated JSON — extracts valid portion, fills typed defaults |
| `field_repair` | Missing or wrongly typed fields — supplies typed defaults |
| `consistency_repair` | Broken cross-layer references — invalid field types (`decimal` → `number`), invalid relation types (`belongsToMany` → `hasMany`), missing inverse relations, missing tenant IDs, invalid auth entities, missing workflow stubs |
| `reprompt_repair` | Failures that can't be resolved deterministically — re-prompts the source model with a targeted correction prompt |

Every repair attempt is logged: strategy applied, error input, outcome (`repaired` | `escalated` | `failed`). Logs are accessible via `GET /api/generate/:jobId`.

---

## Integration Registry

### Fully Implemented (HTTP calls working)

| Integration | Auth | Actions |
|---|---|---|
| Slack | OAuth2 | send_channel_message, send_dm, post_block_message |
| WhatsApp (via Twilio) | API key | send_template_message, send_notification, trigger_conversation |
| Gmail / Google Workspace | OAuth2 | send_email, create_calendar_event |
| Stripe | API key | create_customer, create_charge, create_subscription, issue_refund |
| Jira | API key | create_issue, update_status, add_comment, assign_user |
| GitHub | API key | create_issue, comment_on_pr, trigger_workflow |
| HubSpot | OAuth2 | create_contact, update_deal_stage, add_to_sequence |
| Webhook (generic) | Webhook secret | post_payload |

### Stubbed (registry + schema correct, HTTP call not implemented)

`salesforce`, `notion`, `airtable`, `twilio-sms`, `zapier`, `google_sheets`

Validation rejects: unregistered integration IDs, invalid action IDs, and missing workflow stubs for any integration in `integrations_requested`.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/generate` | Submit prompt → returns `{ jobId }` |
| GET | `/api/generate/:jobId/stream` | SSE stream — emits `stage_start`, `stage_complete`, `stage_failed`, `generation_complete` |
| GET | `/api/generate/:jobId` | Full job result — AppSpec, repair logs, cost breakdown, latency per stage |
| POST | `/api/generate/:jobId/repair` | Manually trigger repair on a specific stage |
| GET | `/api/integrations` | Full integration registry |

---

## Quick Start (Under 5 Minutes)

### Prerequisites
Node.js 18+. At least one AI provider API key (Groq is free and sufficient to run the full pipeline).

### 1. Clone

```bash
git clone https://github.com/Sh10bh/oneatlas-pipeline.git
cd oneatlas-pipeline
```

### 2. Backend

```bash
cd apps/server
cp .env.example .env
# Add at least one API key to .env
npm install
npm run dev
```

Backend starts on `http://localhost:3001`.

### 3. Frontend

```bash
cd apps/web
npm install
npm run dev
```

Frontend starts on `http://localhost:3000`. If your backend is on a different port:

```bash
NEXT_PUBLIC_API_BASE=http://localhost:3001 npm run dev
```

---

## Environment Variables

All keys are optional — the gateway skips providers with missing keys and routes to available ones.

```env
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GROQ_API_KEY=
OPENROUTER_API_KEY=
MISTRAL_API_KEY=
DEEPSEEK_API_KEY=
GEMINI_API_KEY=
GOOGLE_AI_API_KEY=
```

---

## Evaluation

Run the backend first, then:

```bash
cd apps/server
npm run eval
```

Outputs:
- `evaluation/results.json` — machine-readable per-prompt results
- `evaluation/summary.md` — 300-word written summary

### Results (last run)

| Metric | Value |
|---|---|
| Total prompts | 12 |
| Passed | 12 |
| **Success rate** | **100%** |
| Avg latency | ~67s |
| Total cost | $0.003 |
| Avg cost per run | $0.00025 |

All 7 standard prompts and all 5 edge case prompts passed. See `evaluation/results.json` for per-prompt breakdown including repair strategies used, retry count, integrations detected, and cost.

---

## Known Constraints

- In-memory job store — jobs do not persist across server restarts.
- Render free tier spins down after inactivity — first request after idle may take ~30s to wake.
- Evaluation script requires the backend to be running and reachable at `localhost:3001`.
- Frontend is intentionally minimal — optimized for pipeline review coverage, not design polish.
- Live OAuth flows are not implemented — integration actions are stubs with correct metadata and payload schemas.
