# Provenance and license review

Review date: 2026-11-12.

The infrastructure extension was newly authored for this duplicate. No source files, code, benchmark cases, or trajectories were copied from the projects below. They informed design choices only. The source Agent Reliability Lab README currently says that the repository has no declared license; this duplicate retains that state and does not imply that public visibility grants reuse rights. The duplicate is local and has no Git remote until the owner chooses a destination.

| Reference | Use in this work | License observed | Source |
|---|---|---|---|
| Cloud-OpsBench | Benchmark separation, fixed faults and evidence-based outcomes; no artifacts copied | MIT; preserve copyright/license notice if code is later reused | [Repository](https://github.com/LLM4Ops/Cloud-OpsBench), [LICENSE](https://github.com/LLM4Ops/Cloud-OpsBench/blob/main/LICENSE) |
| HolmesGPT | Production SRE agent/tool permission patterns; no code copied | Not verified from an authoritative license file in this research pass; do not copy | [Repository](https://github.com/HolmesGPT/holmesgpt) |
| K8sGPT | Diagnostic-first operations concept; no code copied | Apache-2.0 indicated by upstream repository/license references; no code copied | [Repository](https://github.com/k8sgpt-ai/k8sgpt), [LICENSE](https://github.com/k8sgpt-ai/k8sgpt/blob/main/LICENSE) |
| Strands Agents samples | Agent sample organization; no code copied | Apache-2.0 per official samples repository | [Samples](https://github.com/strands-agents/samples) |

License checks were made with Firecrawl against public GitHub pages. Recheck upstream terms and individual assets before copying any code in a later change. The source repo also notes an existing frontend component adapted from Animate UI (MIT + Commons Clause); that existing provenance is outside the new infra code and remains documented in the inherited README.
