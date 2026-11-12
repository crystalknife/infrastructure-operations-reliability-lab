# Public site and local services deployment

## What is published

The public Observatory is a static GitHub Pages site built from `frontend/`. It publishes the latest committed run summary and scenario catalog. The Python simulator, local Qwen3-4B/llama.cpp server, Nginx container, and Prometheus remain on the operator's computer. A static host cannot run those services or trigger a new evaluation.

The hosted page deliberately hides loopback links. It does not expose Prometheus, Nginx, the model server, or a control API to the public internet. To operate those components, use the local [runbook](infra-runbook.md). A future remote deployment needs a managed server or VM, authenticated access, TLS, durable storage, monitoring retention, and explicit authorization for any agent write operations.

## Enable GitHub Pages once

1. Open the repository's **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Confirm Actions are allowed for the repository.

The repository is public, so GitHub Pages supports this static site. The workflow grants only `contents: read`, `pages: write`, and `id-token: write` to its deployment job. It runs frontend tests and type checking before uploading the build.

## Automatic deployment

`.github/workflows/deploy-pages.yml` builds on pushes to `infra-ops-reliability` when frontend files or the deployment workflow change. The repository path is supplied as the Vite base path, and `404.html` supports direct navigation to React Router pages on GitHub Pages. After the first successful workflow, GitHub reports the public URL in **Actions → Deploy Observatory to GitHub Pages** and **Settings → Pages**. It should use the form `https://crystalknife.github.io/infrastructure-operations-reliability-lab/`.

To publish a new Qwen result, run the incident locally, commit the updated `frontend/public/data/infra-latest.json` and trajectory, and push to the deployment branch. The static site then receives the updated artifact; it does not run Qwen itself.

## Separate Docker observability stack

Keep `docker compose up -d` local. Compose binds Nginx to `127.0.0.1:8088` and Prometheus to `127.0.0.1:9090`, with no public ingress. Do not change these bindings to `0.0.0.0` as part of static-site deployment. The hosted site links to the runbook instead of embedding or exposing these endpoints.

## Verification

The Pages workflow performs `npm ci`, `npm test`, `npm run typecheck`, and the production build. After GitHub Actions reports deployment success, open the published URL and verify `/`, `/infrastructure`, and `/agent-reliability`; hard-refresh each route to validate the fallback and base path. The public incident card should show the committed summary. Prometheus remains accessible only at `http://127.0.0.1:9090/targets` on the machine running Docker.
