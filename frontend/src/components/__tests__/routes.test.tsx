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
import { AgentReliabilityPage, InfrastructurePage, OperationsPage } from "../../pages/pages";

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
    <Route path="/agent-reliability" element={<AgentReliabilityPage />} />
    <Route path="/experiments/*" element={<AgentReliabilityPage />} />
    <Route path="/infrastructure" element={<InfrastructurePage />} />
  </>
);

describe("Agent Reliability Lab handoff", () => {
  it("replaces embedded experiment pages with the original project link", () => {
    at("/experiments/exp-001/trials", <Routes>{routes}</Routes>);
    expect(document.body.textContent).toContain("Project handoff");
    expect(document.body.textContent).toContain("One foundation. A focused extension.");
    expect(document.body.textContent).not.toContain("waiver-c101");
    const link = screen.getByRole("link", { name: /Visit Agent Reliability Lab/ });
    expect(link.getAttribute("href")).toBe("https://agent-reliability-minilab.vercel.app/");
    expect(screen.getByRole("link", { name: "Open the maintainer GitHub profile" }).getAttribute("href")).toBe("https://github.com/crystalknife");
    expect(screen.getByRole("link", { name: "Open the Infrastructure Operations Lab source code" }).getAttribute("href")).toBe("https://github.com/crystalknife/infrastructure-operations-reliability-lab");
  });
});

describe("infrastructure route", () => {
  it("renders a distinct operations overview with a link to the incident lab", async () => {
    at("/", <Routes>{routes}</Routes>);
    await waitFor(() => expect(document.body.textContent).toContain("Latest evaluation"));
    expect(document.body.textContent).toContain("Making infrastructure operations measurable.");
    expect(screen.getByRole("img", { name: /agent diagnoses Nginx memory pressure.*restart_service block.*memory falls from 93 percent to 22 percent/ })).toBeTruthy();
    expect(document.querySelector(".infra-action-block")).toBeTruthy();
    expect(document.body.textContent).toContain("APPLY BLOCK");
    expect(document.body.textContent).toContain("Recovery verified");
    expect(document.body.textContent).toContain("Open incident lab");
    expect(screen.getByRole("link", { name: /Open incident lab/ }).getAttribute("href")).toBe("/infrastructure");
    expect(document.body.textContent).toContain("restart_service");
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
    expect(document.querySelector(".card-ink")?.textContent).toContain("PowerShell · local Qwen");
    expect(screen.getByRole("button", { name: "Refresh result" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Refresh result" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Refresh result" })).toBeTruthy());
  });
});
