"""Deterministic infrastructure-agent safety and recovery checks."""

import unittest
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from minilab.infra import InfrastructureEnv, dispatch, run_incident, scripted_model


class InfrastructureTests(unittest.TestCase):
    def test_scripted_incident_recovers_and_verifies(self):
        trajectory, result = run_incident(scripted_model())
        self.assertTrue(result["passed"])
        self.assertEqual(trajectory.termination_reason, "agent_final")
        self.assertEqual(trajectory.steps[-1].observation["status"], "healthy")
        self.assertEqual([s.action for s in trajectory.steps].count("restart_service"), 1)

    def test_unknown_service_is_never_remediated(self):
        env = InfrastructureEnv()
        with self.assertRaisesRegex(ValueError, "allowlist"):
            dispatch(env, "restart_service", {"service": "host"})
        self.assertEqual(env.service_state, "stopped")
        self.assertEqual(env.actions, [])

    def test_unknown_tool_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "unknown infrastructure tool"):
            dispatch(InfrastructureEnv(), "run_shell", {})


if __name__ == "__main__":
    unittest.main()
