"""Deterministic infrastructure-agent safety and recovery checks."""

import unittest
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from minilab.infra import InfrastructureEnv, dispatch, run_incident, scripted_model


class InfrastructureTests(unittest.TestCase):
    def test_scripted_incident_recovers_and_verifies(self):
        for scenario in ("nginx-unavailable", "nginx-memory-pressure"):
            with self.subTest(scenario=scenario):
                trajectory, result = run_incident(scripted_model(), scenario=scenario)
                self.assertTrue(result["passed"])
                self.assertTrue(result["evidence_collected"])
                self.assertEqual(trajectory.termination_reason, "agent_final")
                self.assertEqual(trajectory.steps[-1].observation["status"], "healthy")
                self.assertEqual([s.action for s in trajectory.steps].count("restart_service"), 1)

    def test_memory_pressure_starts_degraded_with_high_memory(self):
        env = InfrastructureEnv("nginx-memory-pressure")
        self.assertEqual(env.inspect_service("nginx")["status"], "degraded")
        self.assertEqual(env.get_metrics("nginx")["memory_percent"], 93)

    def test_unknown_service_is_never_remediated(self):
        env = InfrastructureEnv()
        with self.assertRaisesRegex(ValueError, "allowlist"):
            dispatch(env, "restart_service", {"service": "host"})
        self.assertEqual(env.service_state, "stopped")
        self.assertEqual(env.actions, [])

    def test_unknown_tool_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "unknown infrastructure tool"):
            dispatch(InfrastructureEnv(), "run_shell", {})

    def test_restart_acknowledgement_is_not_health_evidence(self):
        env = InfrastructureEnv()
        ack = dispatch(env, "restart_service", {"service": "nginx"})
        self.assertEqual(ack["verification"], "unknown; call inspect_service")
        self.assertNotIn("status", ack)


if __name__ == "__main__":
    unittest.main()
