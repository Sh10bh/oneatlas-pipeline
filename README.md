# oneatlas-pipeline

OneAtlas trial-task submission: a 3-stage AI app-generation pipeline with strict validation, repair strategies, provider routing, SSE progress streaming, and a minimal review UI.

## Monorepo Layout

- `apps/server`: Express + TypeScript pipeline backend
- `apps/web`: Next.js frontend console

## Implemented Trial Scope

- 3 pipeline stages:
  - `intent_extraction`
  - `schema_generation`
  - `appspec_generation`
- Validation and cross-layer checks via Zod + custom consistency checks
- Repair strategies:
  - structural repair
  - field repair
  - consistency repair
  - re-prompt repair with source-model-first behavior
- AI gateway with provider routing + fallback
  - OpenAI, Anthropic, Groq, OpenRouter, Mistral, DeepSeek, Gemini, Google AI
  - fallback restricted to `429` or `5xx` failures
- Integration registry and `/api/integrations`
- Job store with stage latency/cost/retry metadata
- SSE streaming (`/api/generate/:jobId/stream`) with stage and repair-log events
- Evaluation runner for 12 prompts with machine-readable outputs

## API Endpoints

- `POST /api/generate`
- `GET /api/generate/:jobId/stream`
- `GET /api/generate/:jobId`
- `POST /api/generate/:jobId/repair`
- `GET /api/integrations`

## Quick Start (Under 5 Minutes)

### 1) Backend

```bash
cd apps/server
npm install
npm run dev
```

Backend starts on `http://localhost:3001`.

### 2) Frontend

```bash
cd apps/web
npm install
npm run dev
```

Frontend starts on `http://localhost:3000`.

If backend is on a non-default URL, set:

```bash
NEXT_PUBLIC_API_BASE=http://localhost:3001
```

## Environment Variables

Copy from `.env.example` and set keys you want to use:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GROQ_API_KEY`
- `OPENROUTER_API_KEY`
- `MISTRAL_API_KEY`
- `DEEPSEEK_API_KEY`
- `GEMINI_API_KEY`

## Evaluation

Run server first, then:

```bash
cd apps/server
npm run eval
```

Generated artifacts:

- `apps/server/evaluation/results.json`
- `apps/server/evaluation/summary.md`

## Notes on Integrations

Implemented integrations:

- `slack`
- `whatsapp`
- `gmail`
- `stripe`
- `jira`
- `github`
- `hubspot`
- `webhook`

Stubbed integrations:

- `salesforce`
- `notion`
- `airtable`
- `twilio-sms`
- `zapier`
- `sheets`

Validation rejects unregistered integration IDs, invalid action IDs, and missing workflow stubs for requested integrations.

## Known Constraints / Scope Cuts

- In-memory job store (no persistent DB).
- Evaluation script assumes backend is running and reachable.
- Frontend is intentionally minimal and optimized for trial-task review coverage over design polish.