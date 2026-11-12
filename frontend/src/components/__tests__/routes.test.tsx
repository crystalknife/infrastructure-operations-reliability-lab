/**
 * Route smoke tests: every route renders against the REAL exported EXP-001
 * data, and the dashboard shows the Python-verified numbers
 * (16 valid, 25% reliability). jsdom + fetch stub (no browser needed).
 * @vitest-environment jsdom
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dataUrl } from "../../lib/load";
import {
  DashboardPage, ExperimentPage, ExperimentsPage, TaskPage, TrialsPage, TrialPage, InfrastructurePage, OperationsPage,
} from "../../pages/pages";

const DATA = join(process.cwd(), "public", "data");

beforeAll(() => {
  const files: Record<string, string> = {};
  for (const f of ["manifest.json", "exp-001.json", "exp-001.traj.json", "tasks.json",
    "exp-002.json", "exp-002.traj.json", "exp-002a.json", "exp-002a.traj.json",
    "exp-002b.json", "exp-002b.traj.json", "exp-002c.json", "exp-002c.traj.json",
    "infra-latest.json"]) {
    files[dataUrl(f)] = readFileSync(join(DATA, f), "utf-8");
  }
  vi.stubGlobal("fetch", async (url: string) => {
    const key = new URL(url, window.location.origin);
    key.search = "";
    return {
      ok: key.href in files,
      json: async () => JSON.parse(files[key.href] ?? "null"),
    };
  });
  Object.defineProperty(window, "matchMedia", {
    value: () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }),
  });
});

afterEach(() => {
  document.body.innerHTML = "";
});

function at(path: string, el: React.ReactNode) {
  return render(<MemoryRouter initialEntries={[path]}>{el}</MemoryRouter>);
}

const routes = (
  <>
    <Route path="/" element={<OperationsPage />} />
    <Route path="/agent-reliability" element={<DashboardPage />} />
    <Route path="/experiments" element={<ExperimentsPage />} />
    <Route path="/experiments/:id" element={<ExperimentPage />} />
    <Route path="/experiments/:id/tasks/:taskId" element={<TaskPage />} />
    <Route path="/experiments/:id/trials" element={<TrialsPage />} />
    <Route path="/experiments/:id/trials/:runId" element={<TrialPage />} />
    <Route path="/infrastructure" element={<InfrastructurePage />} />
  </>
);

describe("routes render real EXP-001 data", () => {
  it("Agent Reliability dashboard remains available at its named route", async () => {
    at("/agent-reliability", <Routes>{routes}</Routes>);
    await waitFor(() => expect(document.body.textContent).toContain("Local Qwen3-4B Baseline"));
    expect(document.body.textContent).toContain("25%");
    expect(document.body.textContent).toContain("valid trials");
    expect(document.body.textContent).toContain("evidence gap");
  });

  it("experiments list shows the artifact", async () => {
    at("/experiments", <Routes>{routes}</Routes>);
    await waitFor(() => expect(document.body.textContent).toContain("exp-001"));
    expect(document.body.textContent).toContain("16 trials");
  });

  it("task page lists its trials", async () => {
    at("/experiments/exp-001/tasks/waiver-c101", <Routes>{routes}</Routes>);
    await waitFor(() => expect(document.body.textContent).toContain("waiver-c101"));
    expect(document.body.textContent).toContain("2 trials");
  });

  it("trials page filters exist", async () => {
    at("/experiments/exp-001/trials", <Routes>{routes}</Routes>);
    await waitFor(() => expect(screen.getByRole("tablist", { name: "Filter trials" })).toBeTruthy());
  });

  it("trials page honors a deep-linked failure filter", async () => {
    at("/experiments/exp-001/trials?failure=evidence_gap", <Routes>{routes}</Routes>);
    await waitFor(() => expect(document.body.textContent).toContain("filtered:"));
    expect(document.body.textContent).toContain("failure: evidence gap");
    expect(document.body.textContent).toContain("waiver-c101");
    expect(document.body.textContent).not.toContain("waiver-c102");
  });

  it("trial page renders steps, final answer, and verdict", async () => {
    const manifest = JSON.parse(readFileSync(join(DATA, "exp-001.json"), "utf-8"));
    const runId = manifest[0].run_id as string;
    at(`/experiments/exp-001/trials/${runId}`, <Routes>{routes}</Routes>);
    await waitFor(() => expect(screen.getByText("final answer", { exact: false })).toBeTruthy());
    expect(document.body.textContent).toContain("evaluator verdict");
    expect(document.body.textContent).toContain("provenance");
  });
});

describe("exp-002 pilot report", () => {
  it("experiments list distinguishes baseline from pilot arms", async () => {
    at("/experiments", <Routes>{routes}</Routes>);
    await waitFor(() => expect(document.body.textContent).toContain("exp-002"));
    expect(document.body.textContent).toContain("baseline");
    expect(document.body.textContent).toContain("pilot");
  });

  it("exp-002 report renders the data-driven five-arm comparison", async () => {
    at("/experiments/exp-002", <Routes>{routes}</Routes>);
    await waitFor(() => expect(document.body.textContent).toContain("Five-arm comparison"));
    const text = document.body.textContent ?? "";
    // Arm titles come from bundles/summary data, not hardcoded JSX.
    for (const name of ["Custom baseline", "LangChain unadjusted", "Chatter stripped",
      "Schema parity", "Schema + chatter"]) {
      expect(text).toContain(name);
    }
    // Derived interpretation labels prove the comparison computed.
    expect(text).toContain("Controlled — matches baseline");
    expect(text).toContain("Matches unadjusted arm");
    // Recovered raw data: normal and combined arms expose per-task sets.
    expect(text).toContain("calc-total-c101");
    expect(text).not.toContain("per-task breakdown unavailable");
  });

  it("control arms keep full trial inspection", async () => {
    at("/experiments/exp-002a/trials", <Routes>{routes}</Routes>);
    await waitFor(() => expect(screen.getByRole("tablist", { name: "Filter trials" })).toBeTruthy());
    expect(document.body.textContent).toContain("waiver-c101");
    expect(document.body.textContent).toContain("waiver-c103");
  });

  it("recovered arms expose trial and trajectory routes", async () => {
    at("/experiments/exp-002c/trials", <Routes>{routes}</Routes>);
    await waitFor(() => expect(screen.getByRole("tablist", { name: "Filter trials" })).toBeTruthy());
    expect(document.body.textContent).toContain("horizon-checking-combined");
  });
});

describe("infrastructure route", () => {
  it("renders a distinct operations overview with a link to the incident lab", async () => {
    at("/", <Routes>{routes}</Routes>);
    await waitFor(() => expect(document.body.textContent).toContain("Latest evaluation"));
    expect(document.body.textContent).toContain("Control room");
    expect(document.body.textContent).toContain("Recovery verified");
    expect(document.body.textContent).toContain("Open incident lab");
    expect(screen.getByRole("link", { name: /Open incident lab/ }).getAttribute("href")).toBe("/infrastructure");
    expect(document.body.textContent).not.toContain("restart_service");
  });

  it("renders a detailed incident lab with scenario catalog and refresh action", async () => {
    at("/infrastructure", <Routes>{routes}</Routes>);
    await waitFor(() => expect(document.body.textContent).toContain("Recovered and verified"));
    expect(document.body.textContent).toContain("nginx-unavailable");
    expect(document.body.textContent).toContain("restart_service");
    expect(document.body.textContent).toContain("Recovery verified: yes");
    expect(document.body.textContent).toContain("nginx-memory-pressure");
    expect(document.body.textContent).toContain("Observe. Diagnose.");
    expect(document.body.textContent?.toLowerCase()).toContain("no docker socket");
    expect(screen.getByRole("button", { name: "Refresh result" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Refresh result" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Refresh result" })).toBeTruthy());
  });
});
