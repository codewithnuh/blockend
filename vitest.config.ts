// vitest.config.ts (At the root of your monorepo)
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // Scan your clean blocks registry for tests
    include: ["blocks/**/*.test.ts"]
  }
});
