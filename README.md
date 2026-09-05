# Ground-to-sky experiment

Branch: `experiment/ground-to-sky`, created from `main`.
The existing English UI changes are included.

[Open the experiment](https://yukagecho-ground-to-sky.taishi-k0903.workers.dev)

Start in Foothill Onsen Town and walk north along the central street.
Cross the red stair bridges through Cloudview Terrace to reach Yuakari Street and the original sky islands.
All seven discoveries are reachable on foot, and the same route leads back to town.
Sakura Springs is east of the main street.
The UI is English, with Japanese place names beneath English headings.

This branch deploys to the separate Cloudflare Worker `yukagecho-ground-to-sky`.
The original `yukagecho-anime` Worker remains unchanged.
The terrain, buildings, and traversal are procedural 3D, with the existing stylized art direction.
The valley is bounded to the town and marked by low rails; distant woodland is scenery.

---

# 湯影町

雲海に浮かぶ温泉街を、浴衣の旅人で歩くブラウザ向け3D散策アプリです。
朱塗りの橋でつながった4つの浮島に、湯あかり通り、雲渡りの湯、風待ち神社、望雲楼があります。

[公開サイトを開く](https://anime.yukagecho.workers.dev)

## 開発

Node.js 22.12以降を使用します。

```sh
npm ci
npm run dev
```

## 操作

| 操作 | キー・ジェスチャー |
| --- | --- |
| 歩く | WASD / 矢印キー |
| 走る | Shift + 移動 |
| 小さく跳ぶ | Space |
| 視点を変える | ドラッグ |
| 距離を変える | ホイール |
| 場所を調べる・記録する | E / 画面下の寄り道ボタン |
| 旅の手帖 | M / ミニマップ |
| UIを隠す | H |
| 閉じる | Esc |
| 視点を戻す | 左上の湯影町ロゴ |

スマートフォンでは左下の方向ボタンで移動できます。
カメラボタンはUIを含まない風景のPNGを保存します。
環境音は音声ボタンを押したときだけ開始します。
湯めぐりの記録は `localStorage` に保存され、ブラウザのデータを消すとリセットされます。

## 技術構成

- Vite + React + TypeScript
- Three.js: 3D地形、建築、旅人、アニメーション、衝突判定
- StyleX: コンパイル時に生成するアプリケーションCSS
- Web Audio API: 風と風鈴の環境音
- Cloudflare Workers Static Assets: 静的配信

SSRが必要ない3Dアプリなので、Next.jsではなくViteを採用しました。
建築と地形はコードで生成し、素材ごとにジオメトリを結合しています。
Blenderや外部モデルのランタイムダウンロードは不要です。
背景の雲海は生成画像をWebPに変換して同梱しています。
日本語フォントにはGoogle Fontsを使用し、通信できない場合はローカルの明朝体・サンセリフ体にフォールバックします。

## 検証

```sh
npm run build
npm run lint
npm test
# 別ターミナルで npm run dev を起動してから実行します。
npm run test:e2e
```

E2Eテストはインストール済みのGoogle Chromeを使います。
橋の地形の連続性、建物と島の端の衝突判定、全島への徒歩移動、記録の保存、ダイアログ中の一時停止、写真ダウンロード、環境音、夜景、モバイル表示を検証します。
スクリーンショットは `/tmp/yukagecho-*.png` に出力されます。

## Cloudflareへの公開

```sh
npx wrangler login
npm run deploy:check
npm run deploy
```

`wrangler.jsonc` でWorker名とSPAの配信を設定しています。
必要な公開アセットだけを `dist/` に出力し、ソースコード・設計画像・テストは配信しません。

## 実装の範囲

地上の温泉街、中腹の展望所、4つの天空の島と遠景で構成される有限の世界です。
旅館内部、入浴モーション、マルチプレイヤーは実装していません。
進行に制限時間やゲームオーバーはありません。
WebGL対応ブラウザが必要で、3D描画が利用できない場合は再読み込みの案内を表示します。

## 町民登録

開始地点の人物の隣にある和風の木製看板をEキーで調べると、メール認証とusername予約へ進めます。
ゲストの初回表示ではモーダルを開かず、初回ログイン後はusername取得画面を自動表示します。
本番Supabaseへのマイグレーションは適用済みで、メール配信はカスタムSMTPとOTPテンプレートの設定待ちです。
設定状況と検証方法は [町民登録の運用メモ](docs/resident-registration.md) を参照してください。
