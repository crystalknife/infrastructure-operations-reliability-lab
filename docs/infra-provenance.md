# Project lineage, open-source references, and license review

Review date: 2026-11-12. Public repository pages and license files were checked with Firecrawl on this date. Recheck upstream terms before any future code or artifact reuse.

## Agent Reliability Lab foundation

This repository is a separate infrastructure-focused duplicate of [crystalknife/agent-reliability-lab](https://github.com/crystalknife/agent-reliability-lab). The base provides the ReAct runner, local model adapter, tool dispatch framework, trajectory format, deterministic evaluator approach, and established Observatory design system. Those inherited files remain identifiable in Git history. The original project checkout was not modified.

New work in this repository includes the infrastructure simulator and allowlist, Nginx/Prometheus Compose environment, incident evaluation, infrastructure-facing interface, and related documentation. The Agent Reliability Lab upstream repository does not declare a repository license in its README; this project does not claim that the inherited work is newly authored or independently relicensed.

## References reviewed and decisions

| Project | Relevant upstream idea | What this lab applies | License review | Source |
|---|---|---|---|---|
| Cloud-OpsBench | Reproducible incident tasks and evidence-oriented root-cause evaluation | Keep incident scenario, evidence collection, trajectory, and deterministic verdict separate. The one current Nginx case is deliberately much smaller than its Kubernetes benchmark. | MIT, verified in repository `LICENSE`; attribution and license notices are required if code is reused. No code or benchmark artifacts copied. | [Repository](https://github.com/LLM4Ops/Cloud-OpsBench), [LICENSE](https://github.com/LLM4Ops/Cloud-OpsBench/blob/main/LICENSE) |
| HolmesGPT | SRE investigations that consult operational context and runbooks before proposing fixes | Put inspection, metrics, and logs before the constrained remediation; make the safety boundary visible in the operations UI. | The current repository README identifies Apache-2.0. The `main/LICENSE` URL was not present during this check, so this is recorded as a README declaration rather than a separately verified license file. No code copied. | [Repository and README](https://github.com/holmesgpt/holmesgpt) |
| K8sGPT | Analyzer-oriented, structured diagnosis for infrastructure resources | Separate read-only diagnostic tools from the allowlisted simulator restart and make post-action health verification a distinct required step. This project does not connect to Kubernetes. | Apache-2.0, verified in repository `LICENSE`. No code copied. | [Repository](https://github.com/k8sgpt-ai/k8sgpt), [LICENSE](https://github.com/k8sgpt-ai/k8sgpt/blob/main/LICENSE) |
| Strands Agents samples | Clear sample organization and evaluation-focused examples | Keep setup, run instructions, safety limits, and evaluation procedure discoverable as separate project documentation sections. No Strands SDK or sample code is included. | Apache-2.0, verified in repository `LICENSE`. | [Samples](https://github.com/strands-agents/samples), [LICENSE](https://github.com/strands-agents/samples/blob/main/LICENSE) |

These references informed patterns and documentation only; they are not runtime dependencies. The actual open-source infrastructure services in the optional local stack are Nginx and Prometheus. The stack and the in-memory agent simulator remain separate.

## Inherited frontend provenance

The source Agent Reliability Lab README documents an existing frontend component adapted from Animate UI under MIT plus Commons Clause terms. That inherited component is outside the new infrastructure page. This extension keeps the existing visual language and does not copy additional upstream UI components.
