// 同時に走る非同期処理を n 個までに抑える。run に渡した順に始まり、結果は渡した関数の結果そのまま
export function limiter(n: number): <T>(fn: () => Promise<T>) => Promise<T> {
  if (!Number.isInteger(n) || n < 1) throw new Error("limiter: n は 1 以上の整数");
  let active = 0;
  const queue: (() => void)[] = [];
  const next = () => {
    if (active >= n) return;
    const start = queue.shift();
    if (start) start();
  };
  return <T>(fn: () => Promise<T>) =>
    new Promise<T>((resolve, reject) => {
      queue.push(() => {
        active++;
        fn()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          });
      });
      next();
    });
}
