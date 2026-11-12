import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@core": fileURLToPath(new URL("./src/tools-core", import.meta.url)),
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    include: ["tests/{unit,golden,property,snapshots}/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/tools-core/**/*.ts"],
      reporter: ["text", "html"],
    },
  },
});
