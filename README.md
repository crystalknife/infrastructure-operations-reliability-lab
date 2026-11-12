# Infrastructure Operations & Reliability Lab

A local lab for testing how AI agents investigate infrastructure incidents, gather evidence, apply a constrained recovery action, and verify service health. It keeps the **Agent Reliability Lab** name and work as its foundation while giving infrastructure operations its own environment, evaluations, and Observatory dashboard.

> This is a separate duplicate of [Agent Reliability Lab](https://github.com/crystalknife/agent-reliability-lab), built from its ReAct loop, local model adapter, tool dispatcher, trajectory recording, deterministic evaluator, and frontend design system. The original repository remains untouched. Infrastructure-specific simulator behavior, safeguards, Docker monitoring stack, evaluation, and interface are new work in this repository.

**Status:** prototype. The agent currently operates on deterministic simulator state. Docker Nginx and Prometheus are a separate local observation stack; the agent cannot control those containers.

## What it does

- Runs five deterministic incidents through the lab’s existing ReAct loop: Nginx unavailable, memory pressure, elevated latency, configuration drift, and Prometheus scrape loss.
- Gives the agent read-only diagnostics plus scenario-gated simulator actions: restart, configuration rollback, or scrape-target restoration.
- Requires collected logs and metrics, exactly one matching action, and separate service or monitoring verification before the deterministic evaluator passes a run.
- Records every run to `results/infra-trajectories.jsonl` and writes the latest summary to `frontend/public/data/infra-latest.json`.
- Provides an infrastructure operations home page with the latest result, action sequence, safety boundaries, run instructions, and links to local Nginx and Prometheus.
- Includes an optional loopback-only Docker Compose stack with Nginx and Prometheus for local observation.

There is no unrestricted shell tool, host process control, Kubernetes API access, or Docker socket exposed to the agent.

## Quick start (Windows PowerShell)

Run these commands from the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[openai]"
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

The `openai` extra is used as a client for the local OpenAI-compatible llama.cpp endpoint. It does not send requests to OpenAI. To run the deterministic control without the model adapter, install the base package with `.\.venv\Scripts\python.exe -m pip install -e .` instead.

Start or keep running the local llama.cpp server with the Qwen model at `http://127.0.0.1:8081/v1`, then run:

```powershell
$env:PYTHONPATH = ".\src"
.\.venv\Scripts\python.exe -m minilab.infra --model local:qwen3-4b
```

To run the scripted harness control (no model server required):

```powershell
$env:PYTHONPATH = ".\src"
.\.venv\Scripts\python.exe -m minilab.infra --model scripted
.\.venv\Scripts\python.exe -m minilab.infra --model scripted --scenario nginx-elevated-latency
.\.venv\Scripts\python.exe -m minilab.infra --model scripted --scenario nginx-config-drift
.\.venv\Scripts\python.exe -m minilab.infra --model scripted --scenario prometheus-scrape-loss
```

## Start the Observatory

In a second PowerShell window, from the repository root:

```powershell
Set-Location .\frontend
npm ci
npm run dev
```

Open `http://localhost:5173/`. After an incident run, choose **Refresh result** on the operations page. The Python run updates the dashboard JSON; the frontend reads that artifact and does not need manual code edits or a rebuild during Vite development.

## Public deployment

The static Observatory is configured for GitHub Pages; local Qwen, Docker Nginx, and Prometheus stay on the developer machine. Enable **Settings → Pages → Source → GitHub Actions** once. Push frontend changes or updated incident artifacts to `infra-ops-reliability`; the Pages workflow runs frontend tests, type checking, and a repository-path-aware build before publishing. The hosted page does not connect to or expose local model or monitoring endpoints. See the [deployment guide](docs/infra-deployment.md).

## Optional Nginx and Prometheus stack

This Compose environment is for observing the local demo service. It is independent of the agent simulator.

```powershell
docker compose config
docker compose up -d
Invoke-WebRequest http://127.0.0.1:8088/health
Invoke-WebRequest http://127.0.0.1:9090/-/ready
```

Open Nginx health at `http://127.0.0.1:8088/health` and Prometheus targets at `http://127.0.0.1:9090/targets`. Stop the optional stack with `docker compose down`.

## How a run is scored

Each scenario has a fixed simulated fault and a narrowly permitted recovery action. A passing trajectory must:

1. Inspect Nginx and collect metrics and logs before taking action.
2. Call exactly one action allowed for that scenario: restart for availability, pressure, or latency; rollback for configuration drift; or restore the scrape target for scrape loss.
3. Verify service health after service recovery, or `scrape_up = 1` after monitoring recovery.

The evaluator checks the trajectory and simulator state. A model’s final claim alone cannot pass the run. The Docker demo’s state is not evidence of simulator recovery.

## Architecture and safety

```text
Local Qwen / scripted control
            │
       Existing ReAct loop  ← Agent Reliability Lab base
            │
    Infrastructure allowlist
       ├── inspect service
       ├── inspect monitoring
       ├── read metrics
       ├── read logs
       ├── restart simulated Nginx
       ├── roll back simulated config
       └── restore simulated scrape target
            │
    Deterministic evaluator
       ├── JSONL trajectory
       └── Observatory summary
```

The tools are bound to an in-memory incident simulator. The separate Docker stack uses loopback-bound ports and is not connected to the agent dispatcher. See the [architecture](docs/infra-architecture.md), [threat model](docs/infra-threat-model.md), [runbook](docs/infra-runbook.md), and [evaluation plan](docs/infra-evaluation-plan.md).

## Open-source research and adaptations

These public projects informed design decisions. No source code or benchmark artifacts have been copied into this repository.

- [Cloud-OpsBench](https://github.com/LLM4Ops/Cloud-OpsBench) — reproducible incident scenarios and evidence-grounded root-cause evaluation informed the scenario/evidence/verdict separation. Its repository declares MIT; code reuse would require retaining its notices.
- [HolmesGPT](https://github.com/holmesgpt/holmesgpt) — SRE investigation and runbook-first workflow patterns informed the emphasis on diagnostics before remediation. The project README identifies Apache 2.0; no code was copied.
- [K8sGPT](https://github.com/k8sgpt-ai/k8sgpt) — analyzer-oriented diagnostic results informed the separation of inspection/evidence from the constrained repair action. Its repository declares Apache 2.0; no code was copied.
- [Strands Agents samples](https://github.com/strands-agents/samples) — sample organization and evaluation-oriented workflow references informed the documentation layout. Its repository declares Apache 2.0; no sample code was copied.

See [reference review and provenance](docs/infra-provenance.md) for source links, license checks, and the specific adaptations. The inherited Agent Reliability Lab code has its own provenance and license status; this repository does not claim ownership of that upstream work.

## Repository map

- `src/minilab/infra.py` — scenario, allowlisted tools, ReAct integration, deterministic evaluator, and artifact output.
- `infra/` — optional Nginx and Prometheus configuration.
- `frontend/src/pages/pages.tsx` — infrastructure operations and incident view.
- `frontend/public/data/infra-latest.json` — latest evaluated summary read by the frontend.
- `results/infra-trajectories.jsonl` — append-only run trajectories.
- `docs/infra-*.md` — design, safety, setup, evaluation, provenance, and progress records.

## Current verification

- Local Qwen3-4B passed all five incidents: unavailable, memory pressure, elevated latency, configuration drift, and scrape loss. Each run gathered evidence, used its scenario-matched action, and verified recovery through the correct health check.
- Python unit suite: 254 tests passed, including all five scripted incident paths, scenario-specific action checks, and target/tool allowlist checks.
- Frontend suite: 14 tests passed; TypeScript typecheck and production build passed.
- Docker Compose Nginx and Prometheus stack was brought up and checked separately.

This is a prototype and successful scripted runs do not establish broad operational reliability. Repeated local-model trials and evaluation of safety failure cases remain future work.
