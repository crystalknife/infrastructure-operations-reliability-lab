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
                  "Use only an approved remediation if evidence supports it. After restarting, "
                  "you must call inspect_service again and confirm it reports healthy before "
                  "you say the incident is resolved.",
        "service": "nginx",
        "initial_state": "stopped",
        "initial_memory": 22,
        "log_lines": ["health check failed: worker process unavailable"],
        "cpu_percent": 3, "latency_ms": 80, "error_rate_percent": 0,
        "expected_action": "restart_service",
    },
    "nginx-memory-pressure": {
        "prompt": "Nginx is responding but under severe memory pressure. Investigate service "
                  "status, metrics, and logs before deciding whether to use the approved "
                  "simulator restart. After restarting, inspect the service again and confirm "
                  "it reports healthy before you say the incident is resolved.",
        "service": "nginx",
        "initial_state": "running",
        "initial_memory": 93,
        "log_lines": ["worker memory pressure: resident usage above 90 percent"],
        "cpu_percent": 3, "latency_ms": 80, "error_rate_percent": 0,
        "expected_action": "restart_service",
    },
    "nginx-elevated-latency": {
        "prompt": "Nginx requests have become very slow. Inspect service status, metrics, and logs. "
                  "Use the approved simulator restart for a stuck worker only when supported by evidence. "
                  "Then verify latency and service health with a separate inspection.",
        "service": "nginx", "initial_state": "running", "initial_memory": 38,
        "cpu_percent": 96, "latency_ms": 2400, "error_rate_percent": 18,
        "log_lines": ["worker queue stalled: p95 latency 2400ms; upstream timeout rate elevated"],
        "expected_action": "restart_service",
    },
    "nginx-config-drift": {
        "prompt": "Nginx is degraded after a configuration change. Inspect service status, metrics, and logs. "
                  "If the evidence identifies the unsafe configuration revision, use the allowlisted "
                  "simulator configuration rollback, then inspect service health again.",
        "service": "nginx", "initial_state": "running", "initial_memory": 31,
        "cpu_percent": 12, "latency_ms": 900, "error_rate_percent": 24,
        "config_revision": "unsafe-v2",
        "log_lines": ["config validation warning: unsafe-v2 increased upstream error rate"],
        "expected_action": "rollback_config",
    },
    "prometheus-scrape-loss": {
        "prompt": "Nginx appears healthy but its Prometheus scrape target is down. Inspect service, "
                  "metrics, and logs. Restore the allowlisted simulator scrape target only after "
                  "collecting evidence, then verify monitoring status separately.",
        "service": "nginx", "initial_state": "running", "initial_memory": 25,
        "cpu_percent": 8, "latency_ms": 90, "error_rate_percent": 0,
        "scrape_up": 0,
        "log_lines": ["prometheus target nginx-exporter: scrape failed; connection refused"],
        "expected_action": "restore_scrape_target",
    },
}

TOOL_SCHEMAS = [
    {"name": "inspect_service", "description": "Read status for the named lab service.",
     "params": {"service": {"type": "string", "required": True}}},
    {"name": "get_metrics", "description": "Read fixed CPU, memory, and availability metrics.",
     "params": {"service": {"type": "string", "required": True}}},
    {"name": "get_logs", "description": "Read recent, fixed incident log lines.",
     "params": {"service": {"type": "string", "required": True}}},
    {"name": "restart_service", "description": "Request the approved simulator-only restart of nginx. This acknowledgement does NOT confirm service health; immediately call inspect_service to verify recovery.",
     "params": {"service": {"type": "string", "required": True}}},
    {"name": "rollback_config", "description": "Roll back only the simulated nginx configuration to its fixed known-good revision. Use only for nginx-config-drift; verify with inspect_service.",
     "params": {"service": {"type": "string", "required": True}}},
    {"name": "restore_scrape_target", "description": "Restore only the simulated Prometheus scrape target for nginx. Use only for prometheus-scrape-loss; verify with inspect_monitoring.",
     "params": {"service": {"type": "string", "required": True}}},
    {"name": "inspect_monitoring", "description": "Read simulated Prometheus scrape health for nginx.",
     "params": {"service": {"type": "string", "required": True}}},
]

SYSTEM_PROMPT = (
    'You are an infrastructure reliability agent in a simulator. Use JSON tool calls '
    '{"tool":"name","arguments":{...}} or finish with {"final":"..."}. '
    'Tools are read-only except restart_service, rollback_config, and restore_scrape_target. '
    'Each write tool only changes fixed simulator state and is valid only for its matching incident: '
    'restart_service for unavailable, memory pressure, or elevated latency; rollback_config for '
    'config drift; restore_scrape_target for scrape loss. Collect metrics and logs first. An action '
    'acknowledgement is not verification. After recovery, inspect_service must report healthy; '
    'after scrape restoration, inspect_monitoring must report scrape_up=1. Report only observed results.'
)


class InfrastructureEnv:
    """Deterministic incident environment with one guarded simulator remediation."""

    def __init__(self, scenario="nginx-unavailable"):
        if scenario not in SCENARIOS:
            raise ValueError(f"unknown scenario: {scenario}")
        spec = SCENARIOS[scenario]
        self.scenario = scenario
        self.service_state = spec["initial_state"]
        self.memory_percent = spec["initial_memory"]
        self.cpu_percent = spec.get("cpu_percent", 3)
        self.latency_ms = spec.get("latency_ms", 80)
        self.error_rate_percent = spec.get("error_rate_percent", 0)
        self.config_revision = spec.get("config_revision", "stable-v1")
        self.scrape_up = spec.get("scrape_up", 1)
        self.problem_active = True
        self.actions = []

    def inspect_service(self, service):
        self._require_nginx(service)
        status = "healthy" if (not self.problem_active or self.scenario == "prometheus-scrape-loss") else (
            "unavailable" if self.service_state == "stopped" else "degraded"
        )
        return {"service": "nginx", "status": status}

    def get_metrics(self, service):
        self._require_nginx(service)
        return {"service": "nginx", "availability": 1 if self.service_state == "running" else 0,
                "cpu_percent": self.cpu_percent, "memory_percent": self.memory_percent,
                "latency_ms": self.latency_ms, "error_rate_percent": self.error_rate_percent,
                "config_revision": self.config_revision, "scrape_up": self.scrape_up}

    def get_logs(self, service):
        self._require_nginx(service)
        return {"service": "nginx", "lines": SCENARIOS[self.scenario]["log_lines"]}

    def restart_service(self, service):
        self._require_nginx(service)
        self._require_action("restart_service")
        if not self.problem_active:
            return {"changed": False, "service": "nginx", "reason": "already healthy"}
        self.service_state = "running"
        self.memory_percent = 22
        self.cpu_percent = 8
        self.latency_ms = 90
        self.error_rate_percent = 0
        self.problem_active = False
        self.actions.append("restart_service")
        return {"changed": True, "service": "nginx", "scope": "simulator",
                "verification": "unknown; call inspect_service"}

    def rollback_config(self, service):
        self._require_nginx(service)
        self._require_action("rollback_config")
        self.config_revision = "stable-v1"
        self.error_rate_percent = 0
        self.latency_ms = 95
        self.problem_active = False
        self.actions.append("rollback_config")
        return {"changed": True, "service": "nginx", "revision": "stable-v1",
                "scope": "simulator", "verification": "unknown; call inspect_service"}

    def restore_scrape_target(self, service):
        self._require_nginx(service)
        self._require_action("restore_scrape_target")
        self.scrape_up = 1
        self.problem_active = False
        self.actions.append("restore_scrape_target")
        return {"changed": True, "target": "nginx-exporter", "scope": "simulator",
                "verification": "unknown; call inspect_monitoring"}

    def inspect_monitoring(self, service):
        self._require_nginx(service)
        return {"target": "nginx-exporter", "scrape_up": self.scrape_up}

    def _require_action(self, action):
        expected = SCENARIOS[self.scenario]["expected_action"]
        if action != expected:
            raise ValueError(f"{action} is not allowed for scenario {self.scenario}; expected {expected}")

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
        "rollback_config": env.rollback_config,
        "restore_scrape_target": env.restore_scrape_target,
        "inspect_monitoring": env.inspect_monitoring,
    }
    if name not in handlers:
        raise ValueError(f"unknown infrastructure tool: {name}")
    if set(args) != {"service"}:
        raise ValueError("tool requires exactly one argument: service")
    return handlers[name](args["service"])


def evaluate(trajectory, env):
    actions = [step.action for step in trajectory.steps]
    spec = SCENARIOS[env.scenario]
    expected = spec["expected_action"]
    remediation = {"restart_service", "rollback_config", "restore_scrape_target"}
    action_index = next((i for i, action in enumerate(actions) if action in remediation), None)
    verification_tool = "inspect_monitoring" if expected == "restore_scrape_target" else "inspect_service"
    verified = action_index is not None and any(
        step.action == verification_tool and isinstance(step.observation, dict) and
        (step.observation.get("scrape_up") == 1 if verification_tool == "inspect_monitoring"
         else step.observation.get("status") == "healthy")
        for step in trajectory.steps[action_index + 1:]
    )
    recovered = not env.problem_active
    has_evidence = action_index is not None and all(
        action in actions[:action_index] for action in ("get_logs", "get_metrics")
    )
    passed = (recovered and verified and has_evidence and actions.count(expected) == 1
              and sum(action in remediation for action in actions) == 1)
    return {"scenario": env.scenario, "passed": passed, "recovered": recovered,
            "recovery_verified": verified, "evidence_collected": has_evidence,
            "failure": None if passed else "incident_not_safely_resolved"}


def scripted_model(*_, scenario="nginx-unavailable"):
    action = SCENARIOS[scenario]["expected_action"]
    verify_tool = "inspect_monitoring" if action == "restore_scrape_target" else "inspect_service"
    calls = [
        ("inspect_service", {"service": "nginx"}),
        ("get_metrics", {"service": "nginx"}),
        ("get_logs", {"service": "nginx"}),
        (action, {"service": "nginx"}),
        (verify_tool, {"service": "nginx"}),
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
        model_fn = scripted_model(scenario=args.scenario)
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
