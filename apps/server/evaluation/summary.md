# Evaluation Summary

## Results

| Metric | Value |
|---|---|
| Total prompts | 12 |
| Passed | 12 |
| Failed | 0 |
| Success rate | 100% |
| Avg latency | 67,702ms |
| Total cost | $0.002981 |
| Avg cost per run | $0.000248 |

---

## Per-Prompt Results

| # | Prompt | Status | Failed Stage | Retries | Integrations Detected | Cost |
|---|---|---|---|---|---|---|
| 1 | CRM for real estate agency | ✅ | — | 1 | whatsapp | $0.000206 |
| 2 | Task manager for engineering team | ✅ | — | 1 | slack | $0.000035 |
| 3 | Inventory system for warehouse | ✅ | — | 1 | gmail | $0.000344 |
| 4 | HR tool for 50-person company | ✅ | — | 1 | slack | $0.000371 |
| 5 | E-commerce backend | ✅ | — | 0 | stripe, gmail | $0.000312 |
| 6 | Event management platform | ✅ | — | 0 | whatsapp | $0.000330 |
| 7 | Project tracker with Jira + Google Sheet | ✅ | — | 0 | jira, google_sheets | $0.000341 |
| 8 | "An app." | ✅ | — | 1 | — | $0.000025 |
| 9 | "Build something like Notion for doctors." | ✅ | — | 0 | webhook | $0.000289 |
| 10 | Platform with login, payments, roles, chat... | ✅ | — | 1 | stripe | $0.000381 |
| 11 | CRM + project manager + invoicing tool | ✅ | — | 1 | — | $0.000317 |
| 12 | "Task manager, but make it smart." | ✅ | — | 0 | gmail | $0.000031 |

---

## Written Summary

**Success rate: 12/12 (100%).** All 7 standard prompts and all 5 edge case prompts passed on the final evaluation run.

**Most common failure type (across development runs):** The most frequent failure was `missing_requested_workflow_stub` in the `appspec_generation` stage. This occurred when the LLM emitted an integration ID that did not match the canonical registry ID — specifically `sheets` vs `google_sheets`. The integration stub was generated but then filtered out by the registry lookup, causing validation to report the stub as missing even though the LLM had attempted to produce it. This was an id mismatch bug, not a generation quality issue.

The second most common failure was `invalid_enum_value` in `schema_generation` — the LLM occasionally emitting SQL-style field types (`decimal`, `numeric`) or relation types (`belongsToMany`) that are not in the validated enum. These failures were non-deterministic and prompt-dependent.

**Weakest stage: `schema_generation`.** It is the most sensitive to LLM non-determinism. Field types, relation types, and bidirectional consistency are all structurally constrained, and the LLM occasionally violates one of them — particularly on complex multi-entity prompts. The repair engine catches most of these, but the stage requires more repair passes than the other two.

**One concrete fix for next iteration:** Extend the `schema_generation` system prompt to explicitly enumerate the disallowed SQL types with their correct equivalents (`decimal → number`, `belongsToMany → hasMany`), and add a pre-validation normalization pass that maps known LLM-emitted variants to valid enum values before Zod validation runs. This would eliminate the class of `invalid_enum_value` errors entirely at the source rather than relying on the repair engine to catch them after the fact — reducing average repair passes per run and improving latency.