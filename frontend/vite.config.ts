import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [tailwindcss()],
    // Vercel-like root hosting stays at /; GitHub Pages uses the repository path.
    base: env.VITE_BASE_PATH || "/",
    build: { outDir: "dist", emptyOutDir: true },
  };
});
