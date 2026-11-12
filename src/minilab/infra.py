"""Infrastructure incident environment for MiniLab.

The agent sees a deterministic, in-memory control plane. It never executes
shell commands, contacts Docker, or receives a Docker socket. The separate
Compose stack is for observing Nginx and Prometheus locally.
"""

import argparse
import json
import time
import uuid
from pathlib import Path

from .agent import run_agent
from .trajectory import save_jsonl

SCENARIOS = {
    "nginx-unavailable": {
        "prompt": "Nginx is unavailable. Investigate the service, metrics, and logs. "
                  "Use only an approved remediation if evidence supports it, then verify recovery.",
        "service": "nginx",
    }
}

TOOL_SCHEMAS = [
    {"name": "inspect_service", "description": "Read status for the named lab service.",
     "params": {"service": {"type": "string", "required": True}}},
    {"name": "get_metrics", "description": "Read fixed CPU, memory, and availability metrics.",
     "params": {"service": {"type": "string", "required": True}}},
    {"name": "get_logs", "description": "Read recent, fixed incident log lines.",
     "params": {"service": {"type": "string", "required": True}}},
    {"name": "restart_service", "description": "Approved recovery action for nginx in this simulator only.",
     "params": {"service": {"type": "string", "required": True}}},
]

SYSTEM_PROMPT = (
    'You are an infrastructure reliability agent in a simulator. Use JSON tool calls '
    '{"tool":"name","arguments":{...}} or finish with {"final":"..."}. '
    'Tools are read-only except restart_service, which only changes simulated nginx state. '
    'Never claim recovery without inspecting service status after the action.'
)


class InfrastructureEnv:
    """Small deterministic environment with a single guarded remediation."""

    def __init__(self, scenario="nginx-unavailable"):
        if scenario not in SCENARIOS:
            raise ValueError(f"unknown scenario: {scenario}")
        self.scenario = scenario
        self.service_state = "stopped"
        self.actions = []

    def inspect_service(self, service):
        self._require_nginx(service)
        return {"service": "nginx", "status": "healthy" if self.service_state == "running" else "unavailable"}

    def get_metrics(self, service):
        self._require_nginx(service)
        return {"service": "nginx", "availability": 1 if self.service_state == "running" else 0,
                "cpu_percent": 3, "memory_percent": 22}

    def get_logs(self, service):
        self._require_nginx(service)
        return {"service": "nginx", "lines": ["health check failed: worker process unavailable"]}

    def restart_service(self, service):
        self._require_nginx(service)
        if self.service_state == "running":
            return {"changed": False, "service": "nginx", "reason": "already healthy"}
        self.service_state = "running"
        self.actions.append("restart_service")
        return {"changed": True, "service": "nginx", "status": "running", "scope": "simulator"}

    @staticmethod
    def _require_nginx(service):
        if service != "nginx":
            raise ValueError("service is not in the allowlist (nginx)")


def dispatch(env, name, args):
    args = args or {}
    handlers = {
        "inspect_service": env.inspect_service,
        "get_metrics": env.get_metrics,
        "get_logs": env.get_logs,
        "restart_service": env.restart_service,
    }
    if name not in handlers:
        raise ValueError(f"unknown infrastructure tool: {name}")
    if set(args) != {"service"}:
        raise ValueError("tool requires exactly one argument: service")
    return handlers[name](args["service"])


def evaluate(trajectory, env):
    actions = [step.action for step in trajectory.steps]
    restart_index = next((i for i, action in enumerate(actions) if action == "restart_service"), None)
    verified = restart_index is not None and any(
        step.action == "inspect_service" and
        isinstance(step.observation, dict) and step.observation.get("status") == "healthy"
        for step in trajectory.steps[restart_index + 1:]
    )
    recovered = env.service_state == "running"
    has_evidence = "get_logs" in actions and "get_metrics" in actions
    passed = recovered and verified and has_evidence and actions.count("restart_service") == 1
    return {"scenario": env.scenario, "passed": passed, "recovered": recovered,
            "recovery_verified": verified, "evidence_collected": has_evidence,
            "failure": None if passed else "incident_not_safely_resolved"}


def scripted_model(*_):
    calls = [
        ("inspect_service", {"service": "nginx"}),
        ("get_metrics", {"service": "nginx"}),
        ("get_logs", {"service": "nginx"}),
        ("restart_service", {"service": "nginx"}),
        ("inspect_service", {"service": "nginx"}),
    ]
    state = {"index": 0}

    def model_fn(messages, tools, config):
        del messages, tools, config
        if state["index"] < len(calls):
            tool, arguments = calls[state["index"]]
            state["index"] += 1
            return {"tool": tool, "arguments": arguments}
        return {"final": "Nginx recovered and a follow-up health inspection confirmed it."}
    return model_fn


def run_incident(model_fn, model="scripted", scenario="nginx-unavailable", max_steps=8):
    spec = SCENARIOS[scenario]
    env = InfrastructureEnv(scenario)
    trajectory = run_agent(
        task_id=f"infra-{scenario}", task_prompt=spec["prompt"], env=env,
        model_fn=model_fn, max_steps=max_steps,
        meta={"run_id": str(uuid.uuid4()), "timestamp": time.time(), "model": model,
              "provider": "local" if model.startswith("local:") else "scripted",
              "task_id": scenario},
        tool_schemas=TOOL_SCHEMAS, dispatch_fn=dispatch, system_prompt=SYSTEM_PROMPT,
    )
    return trajectory, evaluate(trajectory, env)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Run a safe infrastructure incident evaluation")
    parser.add_argument("--model", default="scripted", help="scripted or existing local:<model-id> provider")
    parser.add_argument("--scenario", choices=SCENARIOS, default="nginx-unavailable")
    parser.add_argument("--trajectory", default="results/infra-trajectories.jsonl")
    args = parser.parse_args(argv)
    if args.model == "scripted":
        model_fn = scripted_model()
    elif args.model.startswith("local:"):
        from .models.local import make_local_model
        model_fn = make_local_model(args.model.split(":", 1)[1])
    else:
        parser.error("choose scripted or local:<model-id>")
    trajectory, result = run_incident(model_fn, args.model, args.scenario)
    destination = Path(args.trajectory)
    destination.parent.mkdir(parents=True, exist_ok=True)
    save_jsonl([trajectory], destination)
    dashboard = Path("frontend/public/data/infra-latest.json")
    dashboard.write_text(json.dumps({
        **result, "model": args.model, "steps": len(trajectory.steps),
        "actions": [step.action for step in trajectory.steps],
        "termination_reason": trajectory.termination_reason,
        "trajectory": str(destination).replace("\\", "/"),
    }, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({**result, "trajectory": str(destination), "dashboard": str(dashboard)}, indent=2))
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
