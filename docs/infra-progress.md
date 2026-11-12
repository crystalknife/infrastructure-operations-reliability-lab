# Implementation progress

## 2026-11-12

- Located source project through Codex saved-project inventory at `D:\balasubrahmanya\agent-reliability-lab`.
- Source checkout had uncommitted result artifacts, design docs, and Playwright files; it was not modified.
- Created a separate duplicate from committed Agent Reliability Lab history on branch `infra-ops-reliability`; the original checkout was not modified. Published the duplicate as `crystalknife/infrastructure-operations-reliability-lab`.
- Inspected source architecture: ReAct runner, local Qwen adapter, dispatcher, deterministic evaluator, JSONL trajectories, experiment runner, and static dashboard.
- Added pluggable schemas/dispatcher/system prompt to the existing ReAct loop with defaults preserving MiniBank behavior.
- Added deterministic Nginx incident simulator, fail-closed tool allowlist, recovery verification, scripted control, local Qwen CLI option, and trajectory capture.
- Added Nginx/exporter/Prometheus Compose stack with loopback binds and container restrictions. Agent tools do not control it.
- Added unit checks and an infrastructure-focused Observatory route.
- Added architecture, threat, runbook, evaluation, and provenance documentation.
- `python -m unittest discover -s tests`: 250 tests passed.
- Scripted incident: passed; logs and metrics gathered, one simulated restart performed, post-recovery health verified; trajectory and dashboard summary recorded.
- `docker compose config`: passed. After Docker Desktop became available, all three services started; Nginx reports healthy on `127.0.0.1:8088`, Prometheus is reachable on `127.0.0.1:9090`, and its `nginx` scrape target is `up` with `nginx_up = 1`.
- Frontend tests/build: 22 tests passed; TypeScript typecheck and production build passed. The test run caught a new page fetch-key mismatch; fixed by using the dashboard's base-aware URL helper. Existing dependency warnings about ignored `use client` module directives appear during Vite build.
- Started the local `llama.cpp` server with the existing `Qwen3-4B-Q4_K_M.gguf` model on loopback `127.0.0.1:8081`; `/v1/models` confirmed `qwen3-4b` loaded.
- First live Qwen attempt correctly failed evaluation because it claimed recovery without a post-restart inspection. Tightened the scenario/system/tool instructions and changed restart acknowledgement to report verification as unknown.
- Second live Qwen attempt passed: 5 steps (`inspect_service`, `get_metrics`, `get_logs`, `restart_service`, `inspect_service`), with logs and metrics collected and recovery verified. Latest trajectory and dashboard summary now identify `local:qwen3-4b`.
- Reviewed Cloud-OpsBench, HolmesGPT, K8sGPT, and Strands Agents samples with Firecrawl. Applied evidence-first evaluation, diagnosis-before-remediation, and separated runbook/provenance documentation patterns; no upstream code or benchmark artifacts copied. License sources and caveats are in `docs/infra-provenance.md`.
- Reworked the frontend identity and navigation around Infrastructure Operations & Reliability while retaining the inherited cream/ink/orange palette, typography, and tactile cards. The root page now presents the incident workflow, latest evaluator result, explicit simulator-versus-Docker boundary, local Nginx/Prometheus links, and Qwen run instructions. Historical Agent Reliability experiments remain linked separately.
- Added a dashboard refresh control so new JSON artifacts can be loaded without manually editing frontend code or reloading the whole page.
- Expanded the simulator and scenario catalog with `nginx-memory-pressure` (degraded at 93% memory); evaluator now requires both logs and metrics before remediation.
- Live Qwen3-4B passed the new memory-pressure case in 5 steps. Latest summary and trajectory identify `local:qwen3-4b`, with verified recovery.
- Verification after these changes: Python suite 252 passed; frontend suite 22 passed; TypeScript typecheck passed; production build passed. Build still prints existing dependency warnings that `use client` directives are ignored by Vite.
- GitHub CLI authentication works through the Windows keyring when network access is available. Authenticated repo inventory was checked before creating the requested separate repository.
