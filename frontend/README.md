# MiniLab Frontend — observability over experiment artifacts

Read-only React + TypeScript + Vite + Tailwind v4 + Motion + Lenis.
Never writes to `../results`; never redefines benchmark semantics
(see `src/lib/selectors.ts` header — Python `minilab.metrics` is authoritative).

## Develop

```powershell
npm install
npm run data        # export ../results JSONL -> public/data (read-only source)
npm run dev         # http://localhost:5173
npm test            # vitest: selector formulas pinned to EXP-001 metrics
npm run build       # tsc + vite build -> dist/
```

## Routes

`/` operations home · `/infrastructure` incident lab · `/agent-reliability`
handoff page to the original Agent Reliability Lab. Legacy `/experiments/*`
links also open that handoff page; the original experiment catalogue lives at
https://agent-reliability-minilab.vercel.app/.

## Vendored motion primitives

`src/components/anim/collapsible.tsx` is adapted from Animate UI
(`MIT + Commons Clause`; Radix + motion/react pattern). Tabs/tooltip/badge
are hand-rolled motion components following the same pattern — Animate UI's
own tabs/tooltip were verified as plain Radix without motion, so vendoring
them added nothing.
