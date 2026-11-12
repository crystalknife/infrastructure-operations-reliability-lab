# Setup and incident runbook (Windows PowerShell)

From the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e .
python -m unittest discover -s tests -v
```

Run the deterministic end-to-end incident (no model server or Docker needed):

```powershell
python -m minilab.infra --model scripted
python -m minilab.infra --model scripted --scenario nginx-memory-pressure
```

It appends the full trajectory to `results/infra-trajectories.jsonl`, updates `frontend/public/data/infra-latest.json`, and prints the deterministic recovery result. The Observatory integration is available at `/infrastructure` after `cd frontend; npm ci; npm run dev`.

For a local Qwen run, start the already configured `llama-server` separately at `http://127.0.0.1:8081/v1`, install the existing optional OpenAI client (`python -m pip install -e ".[openai]"`), then run:

```powershell
python -m minilab.infra --model local:qwen3-4b
python -m minilab.infra --model local:qwen3-4b --scenario nginx-memory-pressure
```

The adapter records the selected model in the trajectory. A Qwen run requires the model server and is not part of the deterministic test.

Optional Nginx and Prometheus observation stack:

```powershell
docker compose config
docker compose up -d
Invoke-WebRequest http://127.0.0.1:8088/health
Invoke-WebRequest http://127.0.0.1:9090/-/ready
docker compose down
```

Ports bind only to loopback: Nginx `8088`, Prometheus `9090`. The agent does not control this stack. The Compose services and simulator are independent. If the fixed subnet conflicts, edit the lab-only subnet in `docker-compose.yml` and matching Nginx allowlist in `infra/nginx.conf` together. Use `docker compose logs nginx prometheus` for setup diagnosis.
