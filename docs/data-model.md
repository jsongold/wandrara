目的：WANDRARA のビジネスモデルを、本体のモデルとその関係だけで表す。各モデルに属する項目（分類・写真・事実など）は、この関係が決まってから書く。

# WANDRARA ビジネスモデル

状態：案（2026-11-15）

```mermaid
flowchart TB
  User["User（旅行者 / 運営者）"]
  Tour
  Accommodation
  Experience
  Nature
  Village

  User -- 作る --> Tour
  User -- 運営する（運営者） --> Accommodation
  User -- 運営する（運営者） --> Experience
  Tour -- 含む --> Accommodation
  Tour -- 含む --> Experience
  Tour -- 含む --> Nature
  Tour -- 含む --> Village
  Accommodation -- できる --> Experience
  Accommodation -- 近い --> Nature
  Accommodation -- ある --> Village
  Experience -- 行われる --> Nature
  Experience -- 行われる --> Village
  Village -- 近い --> Nature
  Nature -- 含む --> Nature
```

| モデル | 意味 |
|---|---|
| User | 使う人。旅行者として Tour を作る。運営者なら宿・体験を運営する |
| Tour | User が作る旅の計画。宿・体験・自然・村を順に含む |
| Accommodation | 宿 |
| Experience | 体験 |
| Nature | 自然。海岸・山・湖・高原・渓谷など（城ヶ崎海岸、芦ノ湖、仙石原高原）。自然が自然を含む |
| Village | 村。人が暮らし、歩いて巡る町並み。温泉街・宿場町・漁村など（修善寺温泉街、箱根湯本） |
