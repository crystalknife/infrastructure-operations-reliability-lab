# Threat model and safety boundaries

## Assets and trust boundaries

- Host OS, local files, credentials, Docker Desktop, and any other local services are outside the lab trust boundary.
- The agent receives only fixed synthetic observations and fixed schemas.
- `InfrastructureEnv` stores simulated status in process memory. It has no filesystem, subprocess, network, Docker API, Kubernetes API, SSH, or cloud client.
- Compose containers use a user-defined network, read-only configuration, dropped Linux capabilities, `no-new-privileges`, and loopback-only host ports. Nginx runs as UID 101. Prometheus runs as UID 0 because its writable scratch mount is root-owned; all Linux capabilities are dropped, its root filesystem is read-only, and it has no Docker socket or host mounts.

## Allowed operations

`inspect_service`, `inspect_monitoring`, `get_metrics`, and `get_logs` are read-only. The only writes are `restart_service`, `rollback_config`, and `restore_scrape_target`; each requires exactly `{ "service": "nginx" }`, is hard-coded to in-memory simulator state, and is accepted only for its matching scenario. Unknown tools, service names, and cross-scenario actions fail closed. There is no free-form command, shell, path, URL, or target argument.

## Prompt injection and unsafe proposals

Logs are treated as untrusted evidence; the current fixture does not include natural language remediation instructions. Model output is still untrusted: dispatcher allowlisting is authoritative. A request to invoke any other tool or target cannot reach the host. Future adapters must preserve this boundary and add adversarial log fixtures before expanding scope.

## Limitations

This is a local educational simulator, not a hardened security sandbox. Docker images are version-pinned by tag rather than digest, and image pulls require registry access. The fixed bridge subnet may conflict with a local Docker network. The Compose observation stack is intentionally disconnected from the agent remediation path. Do not point this simulator at production infrastructure or interpret its pass result as proof of safe operations in a live environment.
