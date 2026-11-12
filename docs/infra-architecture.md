# Infrastructure Operations & Reliability extension

## Design

The extension is a second environment for the existing MiniLab ReAct runner. `minilab.infra` supplies its own tool schemas, system prompt, dispatcher, deterministic environment, scenario definition, evaluator, and CLI while reusing `run_agent`, the local `llama-server` adapter, canonical trajectory records, and append-only JSONL writer. The standard MiniBank run path is unchanged.

```text
local Qwen / scripted control
          │ existing model_fn contract
          ▼
     run_agent (ReAct) ───► infra.dispatch ───► InfrastructureEnv (in-memory)
          │                                        │
          └──── canonical trajectory ◄─────────────┘
                         │
                  infra.evaluate
                         │
              JSONL + Observatory page

Docker Compose (separate, optional observation stack): Nginx → exporter → Prometheus
```

## Scenario and tools

Five fixed scenarios cover service availability, 93% memory pressure, elevated latency, configuration drift, and a lost Prometheus scrape target. Read-only tools inspect service/monitoring health, fixed metrics, and incident logs. Three write tools are narrowly scenario-gated: `restart_service` for availability/resource/latency incidents, `rollback_config` for configuration drift, and `restore_scrape_target` for scrape loss. They change in-memory simulator state only. Success requires both logs and metrics before exactly one matching action, followed by service-health or scrape-health verification as appropriate. The evaluator is deterministic and does not use an LLM judge.

Compose runs a separate local Nginx endpoint and Prometheus exporter stack. It is for human observation and setup practice. The agent does not connect to these containers and does not repair live containers.

## Existing Lab architecture inspected

- `src/minilab/agent.py`: bounded ReAct loop; model/tool errors become trajectory outcomes.
- `src/minilab/models/local.py`: OpenAI-compatible local `llama-server` adapter; default endpoint is `127.0.0.1:8081/v1` and default model id is `qwen3-4b`.
- `src/minilab/tools.py`: original MiniBank schemas and dispatcher.
- `src/minilab/trajectory.py`: canonical schema and JSONL append writer.
- `src/minilab/evaluation.py`, `failures.py`, `runner.py`: deterministic answer checks and experiment accounting.
- `frontend/`: Observatory built on the Agent Reliability Lab visual system. `/` is the infrastructure operations home, `/infrastructure` is the incident lab, and `/agent-reliability` is a handoff to the original project's home. Legacy `/experiments/*` URLs also open that handoff page. The latest summary is written by the Python CLI and loaded by the page refresh control.
