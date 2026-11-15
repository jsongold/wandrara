// import:bundle の引数を読む。--parallel は「--parallel」（6 並列）か「--parallel=N」。無ければ 1 つずつ

export const DEFAULT_PARALLEL = 6;
export const MAX_PARALLEL = 16;

export type Args = { file: string | undefined; dryRun: boolean; parallel: number };

export function parseArgs(argv: string[]): { ok: true; value: Args } | { ok: false; error: string } {
  let parallel = 1;
  for (const a of argv) {
    if (a === "--parallel") parallel = DEFAULT_PARALLEL;
    else if (a.startsWith("--parallel=")) {
      const n = Number(a.slice("--parallel=".length));
      if (!Number.isInteger(n) || n < 1 || n > MAX_PARALLEL) return { ok: false, error: `--parallel=N の N は 1〜${MAX_PARALLEL}` };
      parallel = n;
    } else if (a.startsWith("--") && a !== "--dry-run") return { ok: false, error: `知らないオプション: ${a}` };
  }
  return { ok: true, value: { file: argv.find((a) => !a.startsWith("--")), dryRun: argv.includes("--dry-run"), parallel } };
}
