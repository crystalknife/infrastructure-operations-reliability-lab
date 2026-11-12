import * as React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { SmoothRoot } from "./hooks/SmoothRoot";

const AgentReliabilityPage = React.lazy(() =>
  import("./pages/pages").then((m) => ({ default: m.AgentReliabilityPage })));
const InfrastructurePage = React.lazy(() =>
  import("./pages/pages").then((m) => ({ default: m.InfrastructurePage })));
const OperationsPage = React.lazy(() =>
  import("./pages/pages").then((m) => ({ default: m.OperationsPage })));

function Loading() {
  return <p className="p-8 font-mono text-sm">Loading view…</p>;
}

export function App() {
  const basename = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  return (
    <SmoothRoot>
      <BrowserRouter basename={basename}>
        <React.Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<OperationsPage />} />
            <Route path="/experiments/*" element={<AgentReliabilityPage />} />
            <Route path="/infrastructure" element={<InfrastructurePage />} />
            <Route path="/agent-reliability" element={<AgentReliabilityPage />} />
            <Route path="*" element={<InfrastructurePage />} />
          </Routes>
        </React.Suspense>
      </BrowserRouter>
    </SmoothRoot>
  );
}
