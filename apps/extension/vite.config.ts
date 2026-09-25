import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";
import { assertExtensionEnv } from "./env.config";

export default defineConfig(({ mode }) => {
  // Load every var (prefix ""), not just VITE_*, so the non-bundled
  // JOBJET_ALLOW_DEV_CONFIG override flag is visible here too. Only
  // VITE_* values are ever exposed to client code by Vite itself.
  const env = loadEnv(mode, process.cwd(), "");
  // Vitest loads this config too; it doesn't need a real build env.
  if (!process.env.VITEST) {
    for (const warning of assertExtensionEnv(env, mode)) {
      console.warn(`[job-jet] warning: ${warning}`);
    }
  }

  return {
    plugins: [react(), crx({ manifest })],
    server: {
      port: 5173,
      strictPort: true,
      hmr: { port: 5173 },
    },
  };
});
