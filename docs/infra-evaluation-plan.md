# Benchmark and evaluation plan

## Current deterministic control

Five scenarios: `nginx-unavailable`, `nginx-memory-pressure`, `nginx-elevated-latency`, `nginx-config-drift`, and `prometheus-scrape-loss`. The first three use a scenario-gated simulated Nginx restart; configuration drift requires rollback to a fixed known-good revision; scrape loss requires restoring the simulated scrape target. The scripted control collects inspect → metrics → logs before the one matching action, then separately verifies service health or scrape health. `tests/test_infra.py` checks each gold path, cross-scenario action rejection, and that scrape loss does not falsely report the service itself as down.

## Qwen evaluation

Use the existing local Qwen adapter with the same scenario and step budget. Save each canonical trajectory. Report model id/version, run id, prompt hash, step count, termination reason, pass rate, remediation calls, and recovery verification. Repeat trials (suggested: 10 per condition) with temperature 0, while treating temperature 0 as configuration rather than a determinism guarantee. Keep provider errors separate from valid agent outcomes. Do not compare against existing MiniBank scores as if they shared a task distribution.

## Expansion gates

Future expansion should define fixed initial state, allowed observations, a golden action/evidence set, expected safe behavior, and negative tests. Add adversarial log text and prompt injection tests before any tool expands target scope. Do not introduce host shell, generic HTTP, or unrestricted container control.

## Dashboard

The `/` and `/infrastructure` routes read the latest run summary from `frontend/public/data/infra-latest.json`. The Python CLI updates this summary after every run; the page's **Refresh result** control fetches it without a full reload. Detailed per-step arguments and observations remain in the canonical trajectory JSONL. This separate view avoids mixing this task family into current MiniBank experiment aggregates.

The evidence-first workflow and deterministic incident/verdict split were informed by Cloud-OpsBench. HolmesGPT and K8sGPT informed the diagnostic-first and constrained-remediation design. These are design references, not runtime dependencies; no source or benchmark data has been copied. See [provenance](infra-provenance.md).
