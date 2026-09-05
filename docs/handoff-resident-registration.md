# Handoff: 町民登録とusername予約

## このタスクの目的

湯影町の最初のローンチを、世界を散策しながら町民としての名前を確保できる体験にする。
開始地点の看板を調べると案内が開き、サインアップ、username予約へ進める。
キャンペーンの中心は 'Become a resident. Reserve your username.' とする。

ユーザーはどうぶつの森のようなゲーム性に関心があるが、具体的なゲームループはまだ決定していない。
現時点で確定しているのは、町民になるためのsign inと、初回ローンチでのusername予約フローである。
登録を「この街で暮らし始める最初の行動」として世界観につなげる。
今回の依頼はhandoff docの作成のみであり、認証実装、DB変更、メール送信、デプロイは行っていない。

## 決定事項と推奨案

| 項目 | 状態 | 内容 |
| --- | --- | --- |
| 主要ユーザー | 決定済み | 英語圏向けで、基本UIは英語 |
| 固有名詞 | 決定済み | 英語名を大きく、その下に日本語名 |
| ゲーム内入口 | 決定済み | 開始地点の看板をEなどで調べる |
| 初回導線 | 決定済み | 案内 → サインアップ → username予約 |
| 認証・DB | 決定済み | 指定されたSupabaseプロジェクトを使用 |
| ローンチの訴求 | 決定済み | サインアップしてusernameを取るキャンペーン |
| 認証方式 | 推奨案 | メールOTPによるパスワードレス認証 |
| 探索の条件 | 推奨案 | ゲストも探索可能で、登録は強制しない |
| 予約の意味 | 推奨案 | 将来のゲームでも使うアカウント名を確保する |
| usernameルール | 推奨案 | 小文字英数字とアンダースコア、3-20文字、1アカウント1件 |
| 名前の変更 | 推奨案 | 初回は変更UIなしで、確定前に説明する |
| 予約の期限 | 未決定 | 暫定的に自動失効なしとし、永続保証は広告しない |
| 将来のゲーム性 | 未決定 | 住居、家具、交流、採集などは今回に含めない |

この文書の推奨案はユーザーが明示的に選択した仕様と混同しないこと。
通常の実装判断は推奨案を起点に進められるが、外部サービスの送信元や公開ドメインは実設定を確認する。

## 現在の実装と環境

- Workspace: `/Users/taishikato/Documents/taishi/yukagecho-anime`
- Branch: `experiment/ground-to-sky`
- 最新コミット: `fee3a2f` - `Add ground-to-sky exploration with English UI and faster walking`
- Stack: Vite + React + TypeScript + Three.js + StyleX
- 実験版URL: https://yukagecho-ground-to-sky.taishi-k0903.workers.dev
- 元の天空版URL: https://yukagecho-anime.taishi-k0903.workers.dev
- 地上の開始座標: `{ x: 0, y: -27.85, z: 148 }`
- 歩行速度: 5 units/sec、Shift走行: 7.5 units/sec
- 7か所の発見記録は `yukagecho.visits.v1` のlocalStorageに保存される。
- Supabase SDK、認証、町民プロフィールはまだ実装されていない。

作成時点で `wrangler.jsonc` のWorker名が `yukagecho-ground-to-sky` から `anime` に変更された未コミット差分がある。
これはこのドキュメント作成より前から存在する変更で、変更意図や公開済みURLは未確認である。
勝手に戻したり、この差分を無関係なコミットに混ぜたりしないこと。
現在の設定で `npm run deploy` を実行すると対象Workerが変わるため、過去のURLだけを根拠に公開先を決めないこと。

### Supabaseの確認結果

確認日: 2026-09-05 UTC。

- Dashboard: https://supabase.com/dashboard/project/xjplkhzawxmgsglrotsl
- Project ref: `xjplkhzawxmgsglrotsl`
- Project name: `yukagecho`
- Status: `ACTIVE_HEALTHY`
- Region: `us-east-1`
- PostgreSQL: 17
- MCPで `public` のテーブル一覧を取得した結果は空だった。

Authユーザー数、プロバイダー設定、SMTP、CAPTCHA、キー、他のスキーマは確認していない。
publicにテーブルがないことは、プロジェクト全体が未使用であることを意味しない。
実装開始時に再確認し、既存設定やデータを尊重する。

## 最初のプレイ体験

1. 地上の温泉街にゲストとしてスポーンする。
2. 視線の先に 'Resident Registration' の看板が見える。
3. 看板に近づくと 'E · Read the notice' が表示される。
4. Eまたはモバイルのタップで案内モーダルを開く。
5. 'Reserve your username' を選ぶと認証へ進む。
6. メールアドレスを入力し、届いたコードを入力して認証する。
7. usernameを入力して 'Reserve username' を押す。
8. DBで一意に確保できた場合のみ成功画面を表示する。
9. 'Welcome to Yukagecho, @username.' と町民証を表示する。
10. 'Back to town' で同じ場所から探索を再開する。

看板は開始地点の少し前方、例えば `(3.5, -28, 144)` 周辺を候補にする。
最終位置はカメラ、既存看板、提灯、通行経路との重なりをブラウザで確認して決める。
主動線を塞がず、登録せずに天空へ向かうこともできるようにする。
キャンペーンリンク `/?join=1` から案内を直接開ける導線も推奨する。
直接リンクでもゲスト向けの説明を経由し、メール送信や予約を自動実行しない。

## 画面と状態

| 状態 | 看板を調べたときの動作 |
| --- | --- |
| セッション確認中 | 確認中表示で、誤ってゲスト向けフォームを出さない |
| ゲスト | 案内から登録、または既存ユーザーのsign inへ |
| OTP送信済み | コード入力、再送、メール修正、閉じる |
| 認証済み・usernameなし | username予約画面へ直接進む |
| 認証済み・usernameあり | 自分の町民証とsign outを表示 |
| 通信失敗 | 再試行と探索に戻る選択肢を表示 |

Authアカウント作成とusername予約は別の処理である。
途中で閉じた場合や予約に失敗した場合は、認証済み・usernameなしとして次回再開できるようにする。
認証済みという理由だけで町民登録完了と判断しない。
町民判定の正本はDBの予約レコードとする。

モーダル表示中は移動、ジャンプ、視点操作を止める。
入力中のWASD、E、M、Hをゲーム操作として処理しない。
Escで閉じ、キャンセル時は名前を確保せず、閉じた後はcanvasへフォーカスを戻す。
セッション切れ、sign out、他タブでの認証変更を購読し、他人の町民証が画面に残らないようにする。
ログアウトしてもDB上のusernameは保持する。
ページ再読み込み後も自分の予約を取得できること。

## 英語コピー案

| 用途 | コピー |
| --- | --- |
| 看板 | Resident Registration |
| 看板の日本語副題 | 町民登録所 |
| 案内タイトル | Make yourself at home. |
| 案内本文 | Become a resident of Yukagecho and reserve the username you’ll use in town. |
| CTA | Reserve your username |
| 既存ユーザー | Already a resident? Sign in |
| スキップ | Keep exploring |
| 認証フォーム | Continue with email |
| メール送信 | Send code |
| コード入力 | Check your email |
| コード確定 | Verify and continue |
| 再送 | Resend code |
| 予約タイトル | What should we call you? |
| username説明 | 3-20 characters. Use letters, numbers, and underscores. |
| 確定前の説明 | Choose carefully. Username changes aren’t available yet. |
| 予約確定 | Reserve username |
| 競合 | That username is already taken. Try another. |
| 無効な名前 | Use 3-20 letters, numbers, or underscores. |
| 成功 | Welcome to Yukagecho, @username. |
| 成功補足 | Your username is reserved. Your story here is just beginning. |
| 復帰 | Back to town |

まだ実装していない住居、他プレイヤーとの交流、特典、正式ゲームの開始日を約束するコピーは追加しない。
登録キャンペーンとメールマガジン購読は別に扱う。

## 認証の推奨設計

メールOTPは世界を開いたままコードを入力でき、メールリンクから別ブラウザへ移動する問題を減らせる。
`@supabase/supabase-js` の採用バージョンは実装時に確認し、正確なバージョンとlockfileを保存する。
クライアントは単一のSupabase clientを共有する。

新規登録は `signInWithOtp` の `shouldCreateUser: true`、sign in専用入口は `false` を使う案とする。
送信成功は認証成功ではなく、`verifyOtp` がセッションを返してから予約画面に進める。
`signInWithOtp` はデフォルトでMagic Linkを送るため、コード方式を選ぶ場合はメールテンプレートに `{{ .Token }}` を含める設定が必要である。
詳細は[公式メールOTPガイド](https://supabase.com/docs/guides/auth/auth-email-passwordless)を参照する。

公開キャンペーンにはカスタムSMTPを設定する。
標準SMTPは本番向けではなく、送信先制限があるため、設定済みとは仮定しない。
送信元ドメイン、到達性、OTP有効期限、再送制限、CAPTCHA、想定流入に対する送信上限を確認する。
詳細は[公式SMTPガイド](https://supabase.com/docs/guides/auth/auth-smtp)を参照する。

初回はメールOTPのみを推奨し、GoogleなどのOAuthは未決定とする。
公開クライアントにはpublishable keyだけを渡し、service roleや管理用secretは入れない。
想定環境変数は `VITE_SUPABASE_URL` と `VITE_SUPABASE_PUBLISHABLE_KEY` とする。
値は正しいプロジェクトから取得し、Viteのビルド時設定であることをデプロイ手順に記す。

## username予約のデータモデル案

単一テーブル `public.residents` を予約と町民IDの正本にする。
予約レコードは認証完了後の確定操作で作成し、入力中の名前を仮押さえしない。
Authアカウント作成時にusernameを必要とするトリガーは置かない。

| カラム | 型と制約 | 用途 |
| --- | --- | --- |
| user_id | uuid、primary key、auth.users.idへのFK | 1アカウント1件 |
| username | text、not null、unique、check | 正規化済みの予約名 |
| reserved_at | timestamptz、not null、DB default now() | 確保日時 |

前後の空白除去と小文字化をクライアントで行い、保存する小文字表記を確定前に表示する。
DBでも `^[a-z0-9_]{3,20}$` をCHECKで強制し、クライアントを経由しない書き込みも同じ制約にする。
例えば `Taishi` と `taishi` は同じ名前として扱う。
`admin`、`support`、`system`、`yukagecho` など運営用の名前はDB側でも禁止し、最終リストは実装時に定める。
usernameにメールアドレスや認可ロールを兼用しない。
表示名、住所、アバターなどの将来機能を初回テーブルへ先回りして追加しない。

### 原子的な確保と再試行

初回は利用可否の事前検索を必須にせず、確定時のINSERTとunique制約で競合を判定する。
空き確認を追加する場合でも、その結果は確保の保証ではない。
2人が同時に同じ名前を確定した場合、DBで成功するのは1人だけにする。
`upsert` で既存予約を書き換えない。

成功レスポンスを失った場合は、自分のレコードを再取得して結果を復元する。
unique違反時も最初に自分のレコードを取得し、既に確保済みならその町民証を表示する。
自分のレコードがなければusername競合として別の名前を促す。
予約成功画面はDBが返した確定済みのusernameから描画する。

### アクセス制御

RLSを有効にし、authenticatedユーザーが自分のレコードだけをSELECT・INSERTできる構成を起点にする。
INSERTのWITH CHECKで `user_id = auth.uid()` を検証する。
初回はUPDATE・DELETE権限を付与せず、anonには読み書きを許可しない。
メールOTPの確認を必須にし、匿名Authユーザーを町民登録に使わない。
既存プロジェクトで匿名Authが有効なら、DBポリシーでも匿名セッションを拒否する条件が必要になる。
Data APIのスキーマ公開設定、GRANT、RLSは別々に確認する。
user_metadataやフロント側のフラグを権限判定の根拠にしない。

利用可否表示のために全町民一覧のSELECT権限を開けない。
SECURITY DEFINERやservice roleで権限エラーを回避する設計にしない。
詳細は[公式RLSガイド](https://supabase.com/docs/guides/database/postgres/row-level-security)を参照する。
アカウント削除時の名前の解放・保持とFKの削除動作は、運営方針を決めてから明示する。

## 既存コードへの接続点

| ファイル | 現状と変更方針 |
| --- | --- |
| src/world/map.ts | spawn、Place、nearestPlaceを定義している |
| src/world/architecture.ts | 3D看板を構築し、登録用看板を追加する場所 |
| src/world/engine.ts | E入力と近接判定を通知している |
| src/App.tsx | 現在のinteractは場所の発見として手帖に追加する |
| src/styles.ts | StyleXで既存モーダルとフォームの見た目を揃える |
| tests/exploration.spec.ts | ゲスト探索、モーダル、移動停止、7地点の往復確認がある |

登録用看板を通常の `Place` に混ぜて8番目の発見スポットにしない。
地名表示用のnearestPlaceと、Eで起動するinteraction targetを分離する。
例えば `kind: 'discovery' | 'registration'` を持つ型付きの対象を返し、同時に近い場合は登録看板を優先する。
3D側は認証APIを呼ばず、React側へ対象IDと操作イベントを渡す。
UIのプロンプト、キーボードE、タップの3つが同じ対象を起動するようにする。
看板の座標と判定半径は描画と操作で共通定義する。

Supabase初期化は `src/lib/supabase.ts`、認証と予約の状態・UIは `src/features/residency/` にまとめる案とする。
App.tsxには世界との接続とモーダルの開閉だけを残し、認証フロー全体を詰め込まない。
既存の入力除外は一部 `input,textarea` だけなので、モーダル全体と編集可能要素も考慮してM/Hショートカットの漏れを防ぐ。
プロフィール取得失敗をusername未予約と誤判定せず、ロード中・取得失敗・未予約を区別する。

発見手帖は初回ではローカル保存のまま維持する。
町民登録とは別機能として扱い、アカウント間の進行同期は実装しない。

## 実装順序

1. 現在のブランチと未コミット差分、Worker名、Supabaseの既存Auth設定を再確認する。
2. 推奨案を基に登録フローと英語コピーを固定し、SMTP送信元と実際の公開URLを確定する。
3. 開始地点の看板とinteraction targetの分離を実装する。
4. ローカルまたは開発環境でresidents、制約、権限、RLSを作り、変更を追跡可能なmigrationに残す。
5. メール認証、セッション復元、未予約からの再開を実装する。
6. 原子的なusername予約、競合処理、町民証、sign outを実装する。
7. 実DB権限テストとブラウザでの一連の操作を検証する。
8. 対象WorkerとAuth設定を照合して公開し、キャンペーン導線を確認する。

認証メールを実際に送る検証は、明示的に許可されたテスト宛先で実施する。
本番DB変更や公開は、このhandoff doc作成依頼の一部としては実行しない。

## 受け入れ条件

- ゲストが看板を見つけ、PCのEとモバイルのタップで案内を開ける。
- 通常の場所の発見と看板の登録操作が衝突せず、手帖は7地点のままである。
- 未登録でも探索でき、キャンセル後の位置と操作が保たれる。
- 入力中にWASD・E・M・Hがゲームへ漏れず、Esc、Tab、フォーカス復帰が機能する。
- OTP誤入力、期限切れ、再送制限、通信失敗から復帰できる。
- 認証成功後に予約を中断しても、再ログイン時に予約から再開できる。
- usernameの長さ、文字種、大文字小文字、禁止名の制約をUIとDBで検証する。
- 独立した2ユーザーによる同時確保で、同名を取得できるのは1人だけである。
- 二重クリック、別タブ、レスポンス消失後の再試行で予約が増えたり変わったりしない。
- anonや他ユーザーのIDを使った直接API呼び出しで予約の読み取り・作成・変更ができない。
- sign out後も予約が保持され、別端末でsign inすると同じusernameが表示される。
- 公開ビルドに管理用secretが含まれず、認証エラーにメールやトークンを記録しない。
- PC・スマホで登録完了まで到達でき、既存の地上と天空の往復テストも通る。

## ローンチ前の未確定事項

メールOTPを採用するか、Googleなど別の認証方法も提供するか。
送信元ドメイン、メール配信サービス、利用者向けの正式な公開ドメイン。
usernameの禁止リスト、変更・解放・アカウント削除時の扱い。
キャンペーンの開催期間と、予約をどの将来サービスへ引き継ぐかの説明。
利用規約・プライバシー案内の公開先。

必要なら案内表示、認証完了、username確保の件数を集計し、登録率を確認する。
分析にはメール、OTP、トークンを含めず、マーケティングメールへの同意を認証と一緒に扱わない。
採集、家具、家づくり、NPCとの関係などのゲーム性は、登録体験をローンチした後に別途検討する。
