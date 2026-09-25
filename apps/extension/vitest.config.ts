import { defineConfig } from "vitest/config";

// Separate from vite.config.ts on purpose: the build config runs the CRXJS
// plugin and validates production env vars, neither of which unit tests need.
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
  },
});
