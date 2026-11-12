# Infrastructure Operations & Reliability Lab

An infrastructure-focused agent evaluation lab for observing controlled incidents, gathering evidence, choosing a narrowly allowlisted recovery action, and verifying the result. The project has a public Observatory, a deterministic in-memory incident simulator, an optional local Nginx and Prometheus stack, and support for evaluating a local Qwen model through `llama-server`.

**Live site:** [https://crystalknife.github.io/infrastructure-operations-reliability-lab/](https://crystalknife.github.io/infrastructure-operations-reliability-lab/)

**Source:** [crystalknife/infrastructure-operations-reliability-lab](https://github.com/crystalknife/infrastructure-operations-reliability-lab)

> This is a separate infrastructure extension built on the [Agent Reliability Lab](https://github.com/crystalknife/agent-reliability-lab). It reuses the base lab's ReAct runner, local model adapter, tool-dispatch pattern, trajectory format, deterministic evaluation approach, and visual design system. Infrastructure scenarios, simulator behavior, safeguards, monitoring stack, evaluation integration, and interface are developed in this repository. The original Agent Reliability Lab repository is unchanged.

## Project status and scope

The static Observatory is deployed through GitHub Pages. The current evaluator operates on fixed simulator state in the Python process. The optional Docker stack is a separate local monitoring target; the agent does not control it. The hosted site displays the latest committed evaluation artifact and does not execute Qwen or connect to a remote control plane.

The lab is an educational prototype. Passing an incident demonstrates that a trajectory met this lab's deterministic rules; it does not establish production readiness or general operational reliability.

## What is included

- Five repeatable incidents: Nginx unavailable, Nginx memory pressure, elevated latency, configuration drift, and Prometheus scrape loss.
- Read-only agent tools for service inspection, monitoring inspection, metrics, and fixed incident logs.
- Three scenario-gated simulator actions: restart the simulated service, roll back simulated configuration, or restore a simulated Prometheus target.
- A deterministic evaluator that checks evidence collection, the expected action, and separate post-action verification.
- Canonical step-by-step trajectories in `results/infra-trajectories.jsonl` and a latest-run artifact at `frontend/public/data/infra-latest.json`.
- A React Observatory that presents the operations home page, incident workflow, scenario catalog, and latest evaluation.
- An optional Docker Compose Nginx, exporter, and Prometheus stack for local observation.

## Safety boundary

The agent operates only on an in-memory simulator. Its tools do not provide a host shell, arbitrary command execution, filesystem access, generic network requests, SSH, Kubernetes or cloud APIs, Docker API access, or a Docker socket. Remediation tools accept fixed parameters and fail closed for unknown tools, targets, and scenario/action mismatches.

The Docker Compose stack is separate from the simulator and binds its published ports to loopback: Nginx at `127.0.0.1:8088` and Prometheus at `127.0.0.1:9090`. Do not change these bindings to `0.0.0.0` or treat simulated recovery as a change to the Docker service. Review the [threat model](docs/infra-threat-model.md) before extending tool access.

## Architecture

```text
Local Qwen via llama-server, or scripted control
                    │
          Agent Reliability Lab ReAct runner
                    │
       Infrastructure tool allowlist and dispatcher
                    │
        In-memory incident simulator (isolated)
                    │
        Deterministic evaluator and trajectory
             ┌──────┴───────────┐
             │                  │
         JSONL record       Latest-run JSON
                                │
                         Observatory UI

Separate optional Docker stack: Nginx → exporter → Prometheus
```

The Compose stack is an observation surface for a human operator. It does not participate in the agent's simulator state or recovery verdict. See [architecture](docs/infra-architecture.md) for the component breakdown.

## Requirements

- Windows 10/11 with PowerShell is the documented local workflow; Linux/macOS can use equivalent Python and npm commands.
- Python 3.10 or newer.
- Node.js and npm versions supported by the frontend dependencies (the Pages workflow uses Node 24).
- Docker Desktop with Compose, only if you want the optional Nginx and Prometheus stack.
- A running OpenAI-compatible `llama-server` with Qwen3-4B, only for local Qwen evaluations. The model weights and inference server are external dependencies and are not included in this repository.

## Setup (Windows PowerShell)

Run from the repository root:

```powershell
py -3 -m venv .venv
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -e ".[openai]"
python -m unittest discover -s tests -v
```

The `openai` optional dependency is an HTTP client for the local OpenAI-compatible `llama-server` endpoint. The adapter targets `http://127.0.0.1:8081/v1`; it does not send model requests to OpenAI. If you only want to run the simulator with its scripted control, install the base package instead:

```powershell
python -m pip install -e .
```

## Run an incident

### Scripted control (no model server required)

Run the default `nginx-unavailable` incident:

```powershell
python -m minilab.infra --model scripted
```

Choose any supported scenario with `--scenario`:

```powershell
python -m minilab.infra --model scripted --scenario nginx-memory-pressure
python -m minilab.infra --model scripted --scenario nginx-elevated-latency
python -m minilab.infra --model scripted --scenario nginx-config-drift
python -m minilab.infra --model scripted --scenario prometheus-scrape-loss
```

Available scenario identifiers are `nginx-unavailable`, `nginx-memory-pressure`, `nginx-elevated-latency`, `nginx-config-drift`, and `prometheus-scrape-loss`.

### Local Qwen through llama.cpp

Start `llama-server` separately and load Qwen3-4B. The server must expose its OpenAI-compatible API at `http://127.0.0.1:8081/v1`. Confirm that the model is loaded and the endpoint is responding, then run:

```powershell
python -m minilab.infra --model local:qwen3-4b
python -m minilab.infra --model local:qwen3-4b --scenario nginx-memory-pressure
```

Use the same `--scenario` choices listed above. The server address is currently configured in `src/minilab/models/local.py`; changing it requires a code/configuration update. The lab records provider/model errors as run outcomes rather than treating them as successful incident trials.

### Run outputs

Each run appends one canonical trajectory to `results/infra-trajectories.jsonl`, updates `frontend/public/data/infra-latest.json`, and prints a JSON result. The trajectory contains the model metadata and per-step tool interactions; the latest-run file is the smaller summary consumed by the Observatory.

For custom local output paths, use `--trajectory`:

```powershell
python -m minilab.infra --model scripted --trajectory results/demo-run.jsonl
```

The latest summary is still written to the frontend data directory. Run artifacts can contain prompts, observations, and tool arguments; inspect them before sharing or committing.

## Start the Observatory locally

In a second PowerShell window from the repository root:

```powershell
Set-Location .\frontend
npm ci
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/). The main route is the operations home page, `/infrastructure` is the incident lab, and `/agent-reliability` is a project handoff to the original lab's home. After running an incident, select **Refresh result** to load the latest JSON without restarting Vite. During local development, the frontend reads the JSON file directly; no manual frontend source edits are needed to update the displayed result.

To create a production build locally:

```powershell
Set-Location .\frontend
npm run build
npm run preview
```

## Start local Nginx and Prometheus

From the repository root, with Docker Desktop running:

```powershell
docker compose config
docker compose up -d
docker compose ps
```

Check the demo Nginx health endpoint and Prometheus readiness:

```powershell
Invoke-WebRequest http://127.0.0.1:8088/health -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:9090/-/ready -UseBasicParsing
```

Open [Nginx health](http://127.0.0.1:8088/health), [Prometheus targets](http://127.0.0.1:9090/targets), or [Prometheus graph](http://127.0.0.1:9090/graph). The `nginx` scrape target should report `UP` after the exporter is ready. Stop the stack when finished:

```powershell
docker compose down
```

This stack is not required to run the incident simulator or its tests. It is not connected to the agent tool dispatcher, and its health does not determine the simulator verdict. For additional troubleshooting and subnet guidance, see the [local runbook](docs/infra-runbook.md).

## How evaluation works

Each incident starts from fixed synthetic service or monitoring state. A passing run must:

1. Gather the required service/monitoring observations, metrics, and logs before remediation.
2. Use exactly the action allowed for that scenario: simulated restart for availability, memory, or latency; simulated configuration rollback for drift; simulated scrape-target restoration for scrape loss.
3. Perform a separate post-action health inspection. Service incidents require healthy Nginx; scrape-loss requires monitoring recovery.

The evaluator checks the trajectory and simulator state. A model's final statement alone cannot make a run pass. The evaluator is deterministic and does not call a second LLM as a judge. The five scripted scenarios are controls for exercising the rules; they are not a benchmark of general operational competence. For a broader study design, see the [evaluation plan](docs/infra-evaluation-plan.md).

## Public deployment

The [public Observatory](https://crystalknife.github.io/infrastructure-operations-reliability-lab/) is a static GitHub Pages site. The `Deploy Observatory to GitHub Pages` workflow runs frontend tests, TypeScript checking, and a repository-path-aware production build, then publishes the static artifact. It deploys on frontend changes to `infra-ops-reliability` and can also be run manually from GitHub Actions.

The public page shows the latest committed summary. Running Qwen, Docker, or Prometheus on your computer does not update the hosted page automatically. To publish a new summary, commit the updated `frontend/public/data/infra-latest.json` to the deployment branch and push; the Pages workflow then rebuilds and publishes it. Do not commit sensitive run data. Public hosting does not run Python, Qwen, Docker, Prometheus, or any remote agent control API.

See the [deployment guide](docs/infra-deployment.md) for hosting behavior and route checks. GitHub's reference documentation: [deploying with GitHub Actions](https://docs.github.com/en/get-started/start-your-journey/deploying-your-website-automatically) and [configuring the publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Repository guide

| Path | Purpose |
|---|---|
| `src/minilab/infra.py` | Incident definitions, simulator, tool allowlist/dispatcher, evaluator, CLI, and run artifact output. |
| `src/minilab/models/local.py` | OpenAI-compatible local model adapter for `llama-server`. |
| `tests/test_infra.py` | Infrastructure simulator, action-boundary, trajectory, and evaluation checks. |
| `infra/` | Nginx and Prometheus configuration for the optional local Compose stack. |
| `docker-compose.yml` | Local Nginx, exporter, and Prometheus services with loopback-only published ports. |
| `frontend/src/pages/pages.tsx` | Operations home, incident lab, and Agent Reliability Lab handoff pages. |
| `frontend/public/data/infra-latest.json` | Latest evaluated run summary used by the Observatory. |
| `results/infra-trajectories.jsonl` | Canonical trajectory records. Treat observations as potentially sensitive before sharing. |
| `.github/workflows/deploy-pages.yml` | Frontend validation and GitHub Pages deployment workflow. |
| `docs/` | Architecture, threat model, runbook, evaluation, deployment, provenance, and progress records. |

## Documentation and project lineage

- [Architecture](docs/infra-architecture.md)
- [Threat model and safety boundaries](docs/infra-threat-model.md)
- [Setup and incident runbook](docs/infra-runbook.md)
- [Benchmark and evaluation plan](docs/infra-evaluation-plan.md)
- [Deployment guide](docs/infra-deployment.md)
- [Open-source references and provenance](docs/infra-provenance.md)
- [Progress log](docs/infra-progress.md)

Cloud-OpsBench informed the repeatable incident/evidence/evaluation design; HolmesGPT and K8sGPT informed diagnostic-first and runbook-oriented patterns; Strands samples informed example/documentation organization. They are design references, not dependencies, and no source files or benchmark artifacts were copied. The [provenance document](docs/infra-provenance.md) records the review and license notes. It also distinguishes inherited Agent Reliability Lab work from new infrastructure-specific work.

## Contributing and limitations

Useful next extensions include additional deterministic scenarios, adversarial log/prompt-injection fixtures, repeated Qwen trials, and richer trajectory analysis. Any new write tool should have fixed inputs, explicit scenario/action allowlisting, safe failure behavior, post-action verification, and negative tests before it is considered.

Do not point the lab at production infrastructure. The simulator is not a hardened security sandbox, the Docker images are pinned by version tags rather than immutable digests, the local model server must be managed separately, and the hosted Observatory is read-only over committed artifacts. The inherited Agent Reliability Lab license/provenance status is documented in [provenance](docs/infra-provenance.md); this repository does not claim authorship of the base lab.
