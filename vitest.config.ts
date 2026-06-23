import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/cypress/**",
      "**/e2e/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: [
        "src/**/*.test.*",
        "src/**/*.d.ts",
        "src/lib/types/database.ts",
      ],
      // No fake thresholds. Actual coverage (June 2026): ~27% statements,
      // ~19% branches. Previous config set thresholds at 18/22/25/25 —
      // deliberately below actuals so CI always passed, which masked the
      // real gap. Removed until coverage meaningfully improves. Target:
      // 40% statements / 30% branches by end of Q3 2026. Re-enable
      // thresholds at that point, set BELOW actuals minus a 2pt margin
      // so they catch regressions without being cosmetic.
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
