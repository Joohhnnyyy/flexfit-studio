import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    fileParallelism: false,
    exclude: ["node_modules", "dist", ".idea", ".git", ".cache", ".agents/**"],
  },
});
