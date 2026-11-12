import { Link, useParams, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useExperiment, useManifest } from "../hooks/useExperiment";
import { agentReliability } from "../lib/selectors";
import { LabShell } from "../layouts/LabShell";
import { dataUrl } from "../lib/load";
import { DashboardBody } from "../components/Dashboard";
import { Exp002Page } from "../components/Exp002";
import { Empty, Reveal, SectionTitle } from "../components/display";
import { Tabs } from "../components/anim/primitives";
import { StepTimeline, FinalCard, TrialLinkRow, VerdictPanel } from "../components/trajectory";
import { FailurePill, Meta, PassPill, StatusPill } from "../components/display";
import { formatTime, shortId } from "../lib/format";

function Loading({ what }: { what: string }) {
  return <p className="card-flat animate-pulse p-6 font-mono text-sm">Loading {what}…</p>;
}

function Failed({ error }: { error: string }) {
  return <p className="card-flat p-6 font-mono text-sm text-[var(--color-brick)]">Could not load: {error}</p>;
}

/** / — latest experiment dashboard. */
export function DashboardPage() {
  const { entries, error } = useManifest();
  if (error) return <LabShell><Failed error={error} /></LabShell>;
  if (!entries) return <LabShell><Loading what="experiment index" /></LabShell>;
  if (entries.length === 0) return <LabShell><Empty what="experiments — run `npm run data` first" /></LabShell>;
  return <ExperimentPage id={entries[0].id} />;
}

/** /infrastructure — latest deterministic infrastructure incident artifact. */
export function InfrastructurePage() {
  const [incident, setIncident] = useState<{
    scenario: string; passed: boolean; recovered: boolean; recovery_verified: boolean;
    evidence_collected: boolean; model: string; steps: number; actions: string[];
    termination_reason: string; trajectory: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const loadIncident = () => {
    setRefreshing(true);
    setError(null);
    fetch(`${dataUrl("infra-latest.json")}?refresh=${Date.now()}`, { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error("no incident artifact yet"); return r.json(); })
      .then(setIncident)
      .catch((e: Error) => setError(e.message))
      .finally(() => setRefreshing(false));
  };
  useEffect(() => {
    loadIncident();
  }, []);
  return (
    <LabShell>
      <section className="grid gap-6 border-b border-[var(--color-ink-faint)] pb-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-[var(--color-signal)]">Field console · local lab</p>
          <h2 className="font-display mt-3 max-w-3xl text-4xl font-bold leading-[1.02] tracking-tight sm:text-6xl">
            Observe. Diagnose.<br />Recover. Verify.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--color-ink-soft)] sm:text-base">
            A controlled infrastructure operations lab built on Agent Reliability Lab. Run local Qwen through an incident, inspect every tool call, and score recovery with deterministic checks.
          </p>
        </div>
        <div className="border-l-2 border-[var(--color-signal)] pl-4 font-mono text-xs leading-relaxed text-[var(--color-ink-soft)]">
          <p className="uppercase tracking-wider text-[var(--color-ink-faint)]">Safety boundary</p>
          <p className="mt-2">Agent actions affect simulator state only.</p>
          <p>No host shell · no Docker socket · one allowlisted restart.</p>
        </div>
      </section>

      <section className="mt-8" aria-label="Latest incident result">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle index="01" title="Latest incident" hint="simulator result · deterministic evaluation" />
          <button type="button" onClick={loadIncident} disabled={refreshing}
            className="rounded border border-[var(--color-line)] px-3 py-2 font-mono text-xs uppercase tracking-wider hover:bg-[var(--color-paper-deep)] disabled:opacity-60">
            {refreshing ? "Refreshing…" : "Refresh result"}
          </button>
        </div>
        {error && <div className="card-flat mt-4 p-5"><p className="font-mono text-xs text-[var(--color-ink-faint)]">No run artifact yet. From the repository root, run <code>python -m minilab.infra --model local:qwen3-4b</code>.</p></div>}
        {incident && (
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="card p-5">
              <p className="font-mono text-xs uppercase tracking-wider text-[var(--color-ink-faint)]">{incident.scenario} · {incident.passed ? "pass" : "needs review"}</p>
              <h3 className="font-display mt-2 text-2xl font-bold">{incident.passed ? "Recovered and verified" : "Recovery not verified"}</h3>
              <dl className="mt-5 grid grid-cols-2 gap-4 font-mono text-xs">
                <Meta label="model" value={incident.model} />
                <Meta label="steps" value={String(incident.steps)} />
                <Meta label="evidence" value={incident.evidence_collected ? "logs + metrics" : "incomplete"} />
                <Meta label="termination" value={incident.termination_reason} />
              </dl>
              <p className="mt-5 border-t border-[var(--color-paper-deep)] pt-3 font-mono text-[11px] leading-relaxed text-[var(--color-ink-faint)]">This verdict is for the isolated incident simulator. It does not report or change the separate Docker Nginx service.</p>
            </article>
            <article className="card p-5">
              <p className="font-mono text-xs uppercase tracking-wider text-[var(--color-ink-faint)]">trajectory actions</p>
              <ol className="mt-4 space-y-2.5 font-mono text-xs">
                {incident.actions.map((action, i) => <li key={`${i}-${action}`} className="flex gap-3"><span className="text-[var(--color-signal)]">{String(i + 1).padStart(2, "0")}</span><span>{action}</span></li>)}
              </ol>
              <p className="mt-5 border-t border-[var(--color-paper-deep)] pt-3 font-mono text-xs text-[var(--color-ink-faint)]">Recovery verified: {incident.recovery_verified ? "yes" : "no"}</p>
            </article>
          </div>
        )}
      </section>

      <section className="mt-10" aria-label="Incident workflow">
        <SectionTitle index="02" title="Incident workflow" hint="evidence before action" />
        <div className="grid border-y border-[var(--color-line)] sm:grid-cols-4">
          {[
            ["01", "Observe", "Service state, metrics, and fixed logs"],
            ["02", "Diagnose", "Use evidence to justify a response"],
            ["03", "Recover", "One constrained simulator action"],
            ["04", "Verify", "Inspect service health after recovery"],
          ].map(([n, title, detail], i) => (
            <div key={n} className={`py-4 pr-4 ${i ? "border-t border-[var(--color-paper-deep)] sm:border-l sm:border-t-0 sm:pl-4" : ""}`}>
              <p className="font-mono text-xs text-[var(--color-signal)]">{n}</p>
              <h3 className="font-display mt-1 text-xl font-bold">{title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-[var(--color-ink-soft)]">{detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10" aria-label="Available incident scenarios">
        <SectionTitle index="03" title="Scenario catalog" hint="fixed faults · repeatable outcomes" />
        <div className="grid gap-4 sm:grid-cols-2">
          <article className="card p-5">
            <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-signal)]">01 · availability</p>
            <h3 className="font-display mt-1 text-xl font-bold">Nginx unavailable</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-soft)]">Service starts stopped. Inspect health, metrics, and worker logs; restart once and verify health.</p>
            <code className="mt-4 block overflow-x-auto border-t border-[var(--color-paper-deep)] pt-3 font-mono text-[11px]">--scenario nginx-unavailable</code>
          </article>
          <article className="card p-5">
            <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-signal)]">02 · resource pressure</p>
            <h3 className="font-display mt-1 text-xl font-bold">Nginx memory pressure</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-soft)]">Service starts degraded at 93% memory. Evidence must be collected before the simulator restart and a healthy inspection.</p>
            <code className="mt-4 block overflow-x-auto border-t border-[var(--color-paper-deep)] pt-3 font-mono text-[11px]">--scenario nginx-memory-pressure</code>
          </article>
        </div>
        <p className="mt-3 font-mono text-[10px] leading-relaxed text-[var(--color-ink-faint)]">Both incidents use the same restricted tool boundary and deterministic recovery checks. Docker Nginx remains an independent observation target.</p>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div>
          <SectionTitle index="04" title="Local observability" hint="optional Docker stack" />
          <p className="mb-4 max-w-xl text-sm leading-relaxed text-[var(--color-ink-soft)]">These links show the separate Nginx and Prometheus containers. Start them with <code className="font-mono text-xs">docker compose up -d</code> from the repository root.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <a className="card flex items-center justify-between p-4 hover:-translate-y-0.5" href="http://127.0.0.1:8088/health" target="_blank" rel="noreferrer">
              <span><span className="block font-mono text-[10px] uppercase tracking-wider text-[var(--color-ink-faint)]">Nginx</span><span className="font-display text-lg font-bold">Health endpoint</span></span><span aria-hidden="true" className="font-mono text-[var(--color-signal)]">↗</span>
            </a>
            <a className="card flex items-center justify-between p-4 hover:-translate-y-0.5" href="http://127.0.0.1:9090/targets" target="_blank" rel="noreferrer">
              <span><span className="block font-mono text-[10px] uppercase tracking-wider text-[var(--color-ink-faint)]">Prometheus</span><span className="font-display text-lg font-bold">Scrape targets</span></span><span aria-hidden="true" className="font-mono text-[var(--color-signal)]">↗</span>
            </a>
          </div>
        </div>
        <div>
          <SectionTitle index="05" title="Run an evaluation" hint="from the project root" />
          <div className="card bg-[var(--color-ink)] p-5 text-[var(--color-card)]">
            <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-paper-deep)]">PowerShell · local Qwen</p>
            <pre className="mt-3 overflow-x-auto font-mono text-xs leading-relaxed"><code>$env:PYTHONPATH = ".\src"{"\n"}.\.venv\Scripts\python.exe -m minilab.infra --model local:qwen3-4b</code></pre>
            <p className="mt-4 text-xs leading-relaxed text-[var(--color-paper-deep)]">The run appends its trajectory and updates the latest-result file. Select “Refresh result” above to load it without a full page reload.</p>
          </div>
        </div>
      </section>

      <section className="mt-10 border-t border-[var(--color-ink-faint)] pt-5">
        <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-ink-faint)]">Research lineage</p>
        <p className="mt-2 max-w-4xl text-xs leading-relaxed text-[var(--color-ink-soft)]">This is a separate infrastructure-focused duplicate built on the Agent Reliability Lab’s ReAct runner, trajectory format, deterministic evaluation approach, and visual system. Benchmark design was informed by Cloud-OpsBench; diagnostic and runbook-first patterns by K8sGPT and HolmesGPT. No upstream source files were copied.</p>
      </section>
    </LabShell>
  );
}

/** /experiments/:id — dashboard scoped to one experiment. The pilot report
 *  has its own page; every other experiment uses the trial dashboard. */
export function ExperimentPage({ id: propId }: { id?: string }) {
  const params = useParams();
  const id = propId ?? params.id;
  const { bundle, error } = useExperiment(id);
  const { entries } = useManifest();
  if (id === "exp-002") {
    const pilot = entries?.find((e) => e.id === "exp-002");
    if (!pilot) return <LabShell><Loading what="experiment index" /></LabShell>;
    return (
      <LabShell>
        <Exp002Page entry={pilot} />
      </LabShell>
    );
  }
  if (error) return <LabShell><Failed error={error} /></LabShell>;
  if (!bundle) return <LabShell><Loading what={`experiment ${id}`} /></LabShell>;
  return (
    <LabShell>
      <DashboardBody bundle={bundle} />
    </LabShell>
  );
}

/** /experiments — artifact list. */
export function ExperimentsPage() {
  const { entries, error } = useManifest();
  return (
    <LabShell>
      <SectionTitle index="00" title="Experiments" hint={`${entries?.length ?? 0} artifacts`} />
      {error && <Failed error={error} />}
      {!entries && <Loading what="experiments" />}
      <div className="grid gap-4 sm:grid-cols-2">
        {entries?.map((e, i) => (
          <Reveal key={e.id} delay={Math.min(i * 0.05, 0.25)}>
            <Link to={`/experiments/${e.id}`} className="card flex h-full flex-col p-5 hover:-translate-y-0.5">
              <p className="font-mono text-xs text-[var(--color-signal)]">
                {e.id}
                {e.tag && (
                  <span className="ml-2 rounded bg-[var(--color-paper-deep)] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[var(--color-ink-soft)]">
                    {e.tag}
                  </span>
                )}
              </p>
              <h3 className="font-display text-2xl font-bold tracking-tight">{e.name}</h3>
              {e.note && (
                <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink-soft)]">{e.note}</p>
              )}
              <p className="mt-auto pt-2 font-mono text-xs text-[var(--color-ink-soft)]">
                {e.provider} · {e.model} · <span className="tnum">{e.trials} trials</span> · {e.created}
              </p>
            </Link>
          </Reveal>
        ))}
      </div>
    </LabShell>
  );
}

/** /experiments/:id/tasks/:taskId — trials for one task. */
export function TaskPage() {
  const { id, taskId } = useParams();
  const { bundle, error } = useExperiment(id);
  if (error) return <LabShell><Failed error={error} /></LabShell>;
  if (!bundle) return <LabShell><Loading what="task" /></LabShell>;
  const trials = bundle.rows.filter((r) => r.task_id === taskId);
  const rel = agentReliability(trials);
  return (
    <LabShell>
      <Link to={`/experiments/${id}`} className="font-mono text-xs text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">← {id}</Link>
      <h2 className="font-display mt-2 text-4xl font-bold tracking-tight">{taskId}</h2>
      <p className="tnum mt-1 font-mono text-xs text-[var(--color-ink-faint)]">
        {trials.length} trials · reliability {(rel.success_rate * 100).toFixed(0)}% over {rel.n} valid
      </p>
      <div className="mt-6 space-y-2">
        {trials.map((r) => <TrialLinkRow key={r.run_id} row={r} expId={id ?? ""} />)}
        {trials.length === 0 && <Empty what={`trials for ${taskId}`} />}
      </div>
    </LabShell>
  );
}

/** /experiments/:id/trials — filterable trial table.
 * Filters live in the query string (?tab=, ?difficulty=, ?failure=) so every
 * filtered view is deep-linkable, refresh-safe, and back-navigable. */
export function TrialsPage() {
  const { id } = useParams();
  const { bundle, error } = useExperiment(id);
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "all";
  const difficulty = params.get("difficulty");
  const failure = params.get("failure");
  if (error) return <LabShell><Failed error={error} /></LabShell>;
  if (!bundle) return <LabShell><Loading what="trials" /></LabShell>;
  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v === null) next.delete(k);
    else next.set(k, v);
    setParams(next, { preventScrollReset: true });
  };
  const all = bundle.rows;
  const shown = all.filter((r) => {
    if (tab === "passed" && !(r.passed && r.trial_status === "valid")) return false;
    if (tab === "failed" && !(!r.passed && r.trial_status === "valid")) return false;
    if (tab === "provider_error" && r.trial_status !== "provider_error") return false;
    if (difficulty && r.difficulty !== difficulty) return false;
    if (failure && r.failure !== failure) return false;
    return true;
  });
  const tabs = [
    { id: "all", label: "all", count: all.length },
    { id: "passed", label: "passed", count: all.filter((r) => r.passed && r.trial_status === "valid").length },
    { id: "failed", label: "failed", count: all.filter((r) => !r.passed && r.trial_status === "valid").length },
    { id: "provider_error", label: "provider errors", count: all.filter((r) => r.trial_status === "provider_error").length },
  ];
  return (
    <LabShell>
      <Link to={`/experiments/${id}`} className="font-mono text-xs text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">← {id}</Link>
      <h2 className="font-display mt-2 text-4xl font-bold tracking-tight">Trials</h2>
      <div className="mt-4"><Tabs tabs={tabs} value={tab} onChange={(t) => set("tab", t === "all" ? null : t)} label="Filter trials" /></div>
      {(difficulty || failure) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-xs">
          <span className="text-[var(--color-ink-faint)]">filtered:</span>
          {difficulty && <FilterChip label={`difficulty: ${difficulty}`} onClear={() => set("difficulty", null)} />}
          {failure && <FilterChip label={`failure: ${failure.replace(/_/g, " ")}`} onClear={() => set("failure", null)} />}
          <button onClick={() => setParams({}, { preventScrollReset: true })}
            className="underline hover:text-[var(--color-signal)]">clear all</button>
        </div>
      )}
      <div className="mt-4 space-y-2">
        {shown.map((r) => <TrialLinkRow key={r.run_id} row={r} expId={id ?? ""} />)}
        {shown.length === 0 && <Empty what="trials under this filter" />}
      </div>
    </LabShell>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button onClick={onClear} aria-label={`Clear filter ${label}`}
      className="card-flat px-2.5 py-1.5 font-mono text-xs hover:bg-[var(--color-paper-deep)]">
      {label} ✕
    </button>
  );
}

/** /experiments/:id/trials/:runId — full trajectory inspection. */
export function TrialPage() {
  const { id, runId } = useParams();
  const { bundle, error } = useExperiment(id);
  if (error) return <LabShell><Failed error={error} /></LabShell>;
  if (!bundle) return <LabShell><Loading what="trial" /></LabShell>;
  const row = bundle.rows.find((r) => r.run_id === runId);
  const traj = runId ? bundle.trajs[runId] : undefined;
  if (!row || !traj) return <LabShell><Empty what={`trial ${shortId(runId ?? "")}`} /></LabShell>;
  return (
    <LabShell>
      <Link to={`/experiments/${id}/trials`} className="font-mono text-xs text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">← all trials</Link>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="font-display min-w-0 break-words text-3xl font-bold tracking-tight sm:text-4xl">{row.task_id}</h2>
        <span className="flex flex-wrap items-center gap-2">
          <PassPill passed={row.passed} />
          <FailurePill failure={row.failure} />
          <StatusPill status={row.trial_status} />
        </span>
      </div>
      <p className="mt-1 font-mono text-xs text-[var(--color-ink-faint)]">
        run {shortId(row.run_id, 12)} · {row.human_run_id} · seed {row.seed} · {row.model} · {formatTime(row.timestamp)}
      </p>
      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-3">
          <StepTimeline traj={traj} />
          <FinalCard traj={traj} />
        </div>
        <div className="space-y-4 lg:col-span-2">
          <VerdictPanel row={row} />
          <div className="card-flat p-5">
            <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-[var(--color-ink-faint)]">provenance</p>
            <dl className="grid grid-cols-2 gap-3">
              <Meta label="provider" value={traj.provider} />
              <Meta label="model" value={traj.model} />
              {row.framework && <Meta label="framework" value={row.framework} />}
              {row.strategy && <Meta label="strategy" value={row.strategy} />}
              <Meta label="temperature" value={String(traj.temperature)} />
              <Meta label="max steps" value={`${traj.steps.length} / ${traj.max_steps}`} />
              <Meta label="termination" value={traj.termination_reason} />
              <Meta label="prompt hash" value={shortId(traj.prompt_hash, 12)} tip={traj.prompt_hash} />
            </dl>
          </div>
        </div>
      </div>
    </LabShell>
  );
}
