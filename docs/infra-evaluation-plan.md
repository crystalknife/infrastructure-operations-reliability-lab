# Benchmark and evaluation plan

## Current deterministic control

Two scenarios: `nginx-unavailable` (stopped service) and `nginx-memory-pressure` (degraded service at 93% memory). The scripted control emits inspect → metrics → logs → restart → inspect → final for both. A pass requires logs and metrics before the action, a single recovery of the allowlisted service, and a healthy observation after recovery. `tests/test_infra.py` checks both gold paths and rejects unknown targets/tools without changing state.

## Qwen evaluation

Use the existing local Qwen adapter with the same scenario and step budget. Save each canonical trajectory. Report model id/version, run id, prompt hash, step count, termination reason, pass rate, remediation calls, and recovery verification. Repeat trials (suggested: 10 per condition) with temperature 0, while treating temperature 0 as configuration rather than a determinism guarantee. Keep provider errors separate from valid agent outcomes. Do not compare against existing MiniBank scores as if they shared a task distribution.

## Expansion gates

Before adding scenarios, define fixed initial state, allowed observations, a golden action/evidence set, expected safe behavior, and negative tests. Candidate scenarios include Nginx configuration drift, elevated latency, and monitoring scrape loss. Add adversarial log text and prompt injection tests before any tool expands target scope. Do not introduce host shell, generic HTTP, or unrestricted container control.

## Dashboard

The `/` and `/infrastructure` routes read the latest run summary from `frontend/public/data/infra-latest.json`. The Python CLI updates this summary after every run; the page's **Refresh result** control fetches it without a full reload. Detailed per-step arguments and observations remain in the canonical trajectory JSONL. This separate view avoids mixing this task family into current MiniBank experiment aggregates.

The evidence-first workflow and deterministic incident/verdict split were informed by Cloud-OpsBench. HolmesGPT and K8sGPT informed the diagnostic-first and constrained-remediation design. These are design references, not runtime dependencies; no source or benchmark data has been copied. See [provenance](infra-provenance.md).
