# Benchmark and evaluation plan

## Current deterministic control

One scenario: `nginx-unavailable`. The scripted control emits inspect → metrics → logs → restart → inspect → final. A pass requires collected logs and metrics, a single recovery of the allowlisted service, and a healthy observation after that recovery. `tests/test_infra.py` also checks that unknown target names and unknown tools are rejected without changing state.

## Qwen evaluation

Use the existing local Qwen adapter with the same scenario and step budget. Save each canonical trajectory. Report model id/version, run id, prompt hash, step count, termination reason, pass rate, remediation calls, and recovery verification. Repeat trials (suggested: 10 per condition) with temperature 0, while treating temperature 0 as configuration rather than a determinism guarantee. Keep provider errors separate from valid agent outcomes. Do not compare against existing MiniBank scores as if they shared a task distribution.

## Expansion gates

Before adding scenarios, define fixed initial state, allowed observations, a golden action/evidence set, expected safe behavior, and negative tests. Candidate scenarios include Nginx configuration drift, elevated latency, and monitoring scrape loss. Add adversarial log text and prompt injection tests before any tool expands target scope. Do not introduce host shell, generic HTTP, or unrestricted container control.

## Dashboard

The `/infrastructure` route reads the latest run summary from `frontend/public/data/infra-latest.json`. Detailed per-step arguments and observations remain in the canonical trajectory JSONL. This separate view avoids mixing this task family into current MiniBank experiment aggregates.
