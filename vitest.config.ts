import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

// e2e/ は Playwright で動かす（pnpm test:e2e）
// @ は src（部品の描画テストが @/ で読む）
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { exclude: [...configDefaults.exclude, "e2e/**", ".claude/**"] },
});
