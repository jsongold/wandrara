// 地図を「画面に近づいたら一度だけ開き、片付けで必ず閉じる」流れ。DOM と MapLibre には触らない（部品から渡す）。
//   observe: 近づいたら onNear を呼ぶ見張りを始め、止める関数を返す
//   load:    ライブラリと見た目の定義を読み、地図を作る関数を返す（作るのは片付け前のときだけ）
//   onError: 読めなかったとき（作り直しは部品側で、もう一度 startLazyMap を呼ぶ）
// 返す関数で片付ける：見張りを止め、作った地図は remove、読み込み中なら作らない。
export type LazyMapDeps<M extends { remove(): void }> = {
  observe(onNear: () => void): () => void;
  load(): Promise<() => M>;
  onError(e: unknown): void;
};

export function startLazyMap<M extends { remove(): void }>({ observe, load, onError }: LazyMapDeps<M>): () => void {
  let map: M | null = null;
  let done = false;
  let started = false;
  let stop: () => void = () => {};
  stop = observe(() => {
    if (started || done) return;
    started = true;
    stop();
    load().then(
      (create) => {
        if (done) return;
        // WebGL が使えない端末などでは作る時点で失敗する
        try {
          map = create();
        } catch (e) {
          onError(e);
        }
      },
      (e) => {
        if (!done) onError(e);
      },
    );
  });
  // observe の中ですぐ近づいた（その時点では stop が未設定）場合も見張りを止める
  if (started) stop();
  return () => {
    done = true;
    stop();
    map?.remove();
    map = null;
  };
}
