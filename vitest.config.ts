import { configDefaults, defineConfig } from "vitest/config";

// e2e/ は Playwright で動かす（pnpm test:e2e）
export default defineConfig({
  test: { exclude: [...configDefaults.exclude, "e2e/**", ".claude/**"] },
});
