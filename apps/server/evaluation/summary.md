# Evaluation Summary

Across 12 prompts, the pipeline completed 12 successfully for a success rate of 1. Mean end-to-end latency was 38881 ms per run. Total estimated spend was $0.01322, averaging $0.001102 per generation. The most common failure type observed in logs was "consistency_repair", and the weakest stage by failure count was "none".

The data shows the system is generally stable on standard prompts and that edge-case ambiguity still drives the majority of escalations. Repair logs indicate structural and field-level fixes recover many malformed outputs before hard failure, but cross-layer consistency issues remain the key quality risk in difficult prompts.

Next concrete fix: add a deterministic pre-validation normalization pass before AppSpec validation to enforce required workflow stubs for all requested integrations and to auto-backfill missing page-to-API bindings when the entity mapping is unambiguous. This should directly reduce failures in none without increasing model cost.

See `evaluation/results.json` for full per-prompt evidence.
