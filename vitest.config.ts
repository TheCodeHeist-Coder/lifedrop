import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // The integration tests share one database, so test files must not overlap.
  test: { include: ["src/**/*.test.ts"], fileParallelism: false },
});
