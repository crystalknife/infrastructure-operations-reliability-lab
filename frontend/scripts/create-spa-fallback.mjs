import { copyFile } from "node:fs/promises";

// GitHub Pages has no rewrite rules. Serve the same base-aware app shell for
// deep client-side routes such as /infrastructure.
await copyFile(new URL("../dist/index.html", import.meta.url), new URL("../dist/404.html", import.meta.url));
