import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/sudoku-coach/",
  test: {
    environment: "node",
    testTimeout: 20_000,
  },
});
