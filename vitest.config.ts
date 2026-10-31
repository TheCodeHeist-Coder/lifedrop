import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["src/**/*.test.ts"],
    // The integration tests share one database, so test files must not overlap.
    fileParallelism: false,
    // Tests must never spend real API quota or send real WhatsApp messages, even
    // when .env.local holds live credentials.
    env: { GEMINI_API_KEY: "", TWILIO_ACCOUNT_SID: "", TWILIO_AUTH_TOKEN: "", PUBLIC_URL: "" },
  },
});
