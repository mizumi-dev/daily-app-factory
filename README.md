# 日刊アプリ工房 (daily-app-factory)

DeepSeek V4 が毎日 1 本、単一 HTML のアプリを企画・実装・検証・公開し続ける自律サービス。
お題はサイトの投稿欄から受け取り、空のときは AI が自分で市場を調べてネタを決める。

- 設計書: [docs/nikkanappkobo-v0.2.pdf](docs/nikkanappkobo-v0.2.pdf)
- 生成モデル: DeepSeek V4-Pro / Flash（画像判定は `deepseek-v4-flash-vision-exp`）
- 基盤: Cloudflare Workers 一式（D1 / R2 / KV / Queues / Browser Rendering / Turnstile）
- 頻度: 1 日 1 本（cron、04:00 JST）

## 構成（予定）

```text
.
├── docs/          # 設計書などのドキュメント
├── scripts/       # Phase 0 のローカル生成パイプライン
├── generated/     # 生成したアプリのアーカイブ（Git にも残す）
├── workers/       # ギャラリー Worker・日次パイプライン（Phase 1 以降）
└── migrations/    # D1 マイグレーション（Phase 1 以降）
```

## 開発コマンド

```bash
npm run check   # リポジトリ健全性チェック（CI でも実行）
npm run generate -- --brief "お題"            # Phase 0: アプリを1本生成
npm run verify -- generated/.../index.html    # 生成アプリの静的検証
npm run feedback -- list                      # アプリごとのフィードバック一覧
npm run dashboard                             # ダッシュボードを再生成
```

## Phase 1: ギャラリー（Worker + D1 + R2）

ローカル開発（Cloudflare アカウント不要）:

```bash
npm run thumbs          # SVG サムネイル生成
npm run seed:local      # generated/ のアプリをローカル D1/R2 に投入
npm run dev:gallery     # http://127.0.0.1:8787 でギャラリーを起動
```

デプロイ（Cloudflare アカウントが必要）:

```bash
npx wrangler login
npx wrangler d1 create daily-app-factory-db        # 発行された database_id を workers/gallery/wrangler.toml に設定
npx wrangler r2 bucket create daily-app-factory-apps
npx wrangler d1 migrations apply daily-app-factory-db --remote --config workers/gallery/wrangler.toml
npm run seed                                       # 本番 D1/R2 に投入
npm run deploy
```

ルーティング: `/`（ギャラリー SSR）・`/api/apps`（JSON）・`/app/:slug`（アプリ本体）・`/app/:slug/thumb.svg`・`/sitemap.xml`・`/feed.xml`。

## Phase 3: お題投稿欄

ギャラリー上部のフォームからお題を投稿できる（ログイン不要・10〜300文字）。

- `POST /api/briefs`: Turnstile 検証 → レート制限（IP 1日3件 / 全体50件）→ V4-Flash モデレーション → キュー投入
- `GET /brief/:token`: 追跡ページ（待ち行列位置・着手予定日・結果 URL）
- パイプラインは毎朝 `queued` のお題を最優先で制作する

Turnstile は現在テストキー（常に通過）。本番公開前に Cloudflare ダッシュボードでウィジェットを作成し、`TURNSTILE_SITE_KEY`（vars）と `TURNSTILE_SECRET_KEY`（secret）を差し替えること。

## Phase 0: 手動 1 本パイプライン

1. `.dev.vars.example` を `.dev.vars` にコピーし、DeepSeek API キーを記入する（`.dev.vars` はコミットされない）。
2. 生成する:

   ```bash
   npm run generate -- --brief "3分後にそっと消えるメモ" --axis lighten
   ```

3. `generated/YYYY-MM-DD-<slug>/index.html` をブラウザで開き、検証チェックリスト（AGENTS.md 参照）を目視確認する。

ハウススタイル規約は [config/house-style.md](config/house-style.md) にあり、毎回の生成プロンプトの固定部分として使われる。
モデル分担は、企画（spec 生成）が DeepSeek を含む複数 AI の会議（お題決定 → 提案 → 相互レビュー → 修正）→ DeepSeek V4-Pro 審査役の選定、実装（HTML 生成）が `deepseek-v4-flash`（非思考・コスト優先）を基本とし、**実装が2回検証に失敗した場合のみ最終試行を `deepseek-v4-pro`（非思考）にエスカレーション**する。ローカル生成は従来どおり `--model` / `--impl-model` で上書きできる。

### 企画会議（お題決定 → 提案 → 相互レビュー → 修正 → 審査）

パイプラインの企画ステージは、**DeepSeek と交代制で選ばれた 1 社（OpenAI → Claude → Gemini の順）** による AI 同士の会議形式。

1. **お題の決定**: ユーザー投稿のお題はそのまま確定。それ以外（シグナル/自動）は、ペアの AI が軸に合うお題候補を出し合い、DeepSeek Pro 議長が選定する。
2. **第1ラウンド 初期提案**: 両者が独立に企画書を 1 案ずつ提出。
3. **第2ラウンド 相互レビュー**: それぞれが相手の案を建設的にレビュー（良い点・問題点・改善提案）。
4. **第3ラウンド 修正案**: レビューを踏まえて各自が企画書を修正・再提出。
5. **審査**: DeepSeek Pro が最終案を採点して 1 案を選定。

全ラウンドの発言は議事録（`/app/<slug>/minutes.md`）に記録され、どの AI なら議論に耐えられるかを比較できる。参加ペアと採用 AI はギャラリーのカード・ダッシュボード・`/_status` にも表示される。

- 参加モデル（環境変数で上書き可）:
  - DeepSeek: `DEEPSEEK_API_KEY` / `DEEPSEEK_PLAN_MODEL`（既定 `deepseek-v4-pro`）
  - OpenAI: `OPENAI_API_KEY` / `OPENAI_PLAN_MODEL`（既定 `gpt-5-mini`）
  - Anthropic: `ANTHROPIC_API_KEY` / `ANTHROPIC_PLAN_MODEL`（既定 `claude-sonnet-5`）
  - Gemini: `GEMINI_API_KEY` / `GEMINI_PLAN_MODEL`（既定 `gemini-3.7-flash`）
- キーがないプロバイダは自動スキップ。その日の相手は有効なプロバイダの中から交代で選ばれる。
- 手動実行で特定の相手を指定: `POST /_run` のボディに `"partner": "openai" | "anthropic" | "gemini"` を渡す。
- 実装は従来どおり DeepSeek V4-Flash（2回検証失敗後は Pro へエスカレーション）。
- ローカルは `workers/gallery/.dev.vars`、本番は `npx wrangler secret put <キー名> --config workers/gallery/wrangler.toml` で設定する。

### 市場調査（欲求シグナルの収集）

毎朝 02:00 JST に自動実行され、以下の情報源から「〜がない」「誰か作って」「毎回面倒」のような欲求を DeepSeek V4-Pro が抽出して D1 に貯める。生成時はスコア順に未使用のシグナルを 1 件選び、お題会議でどう料理するかを AI 同士が議論する。

- Hacker News（Show HN） / Reddit（r/SomebodyMakeThis・r/Lightbulb） / Google Trends（日本） / Zenn
- X（公式 API v2。`X_BEARER_TOKEN` 設定時のみ・X の有償プランが必要）
- note.com（ユーザーRSS。`NOTE_USERS` でカスタマイズ可・既定は 6 アカウント）
- Product Hunt（公式フィード）

- 抽出は Pro（思考モード）。「単一 HTML で作れる範囲・複数投稿に共通するニーズ」を優先し、医療/法律/投資は除外
- 情報源ごとの信頼度ウェイトでスコア補正（Reddit / X の「作って」系を高く、Trends / Zenn の話題系を低く）
- URL 重複は自動スキップ。抽出が空のときは生テキストを低スコアでフォールバック保存
- 収集結果とコストは `/_status` の `lastCollect` で確認できる

ハウススタイル規約の**基本は v2（試行版）**。v1 / v3 は明示指定時のみ使われる（ローカル生成 `--style v1|v3`、パイプラインは `{"style":"v1"|"v3"}` または環境変数 `HOUSE_STYLE_VERSION=v1|v3`）。v2 はブラウザ標準 API の許可・状態保存の拡張（URL hash / IndexedDB）・サイズ目安の緩和（15〜60KB）・演出の積極化が差分。v3 はさらに初回起動時の空状態対策・アクセシビリティ強化（WCAG AA・可視フォーカス・44px タップ領域・スキップリンク）・状態保存の透明性（保存先の明示・リセット・エクスポート/インポート）・権限 API の明示操作起点・音声の自動再生禁止・`eval` 等の動的コード実行禁止を追加。安全性の要（外部通信禁止・単一 HTML・200KB 上限・医療/法律/投資の禁止）は全バージョンで維持。

パイプラインの手動実行は `POST /_run` のボディに `"style": "v1"` / `"style": "v3"` を渡すとそのバージョンで制作できる（cron の毎日実行は既定 v2）。

## アプリごとのフィードバック

生成したアプリへの意見は、そのアプリの `generated/<日付>-<slug>/feedback.md` に1件ずつ記録する（規約には一般化しない）。
一覧は `feedback/index.md` に自動集計される。

```bash
npm run feedback -- add anger-bonfire-3min "3分は長い"          # 意見を追加
npm run feedback -- list                                         # 全アプリの意見を一覧
npm run feedback -- resolve anger-bonfire-3min 2                 # 対応済みにする（番号は list で確認）
```

## ダッシュボード

生成アプリ全体をまとめた一覧ページを `dashboard/index.html` に生成する（検索・軸フィルタ・ソート・プレビュー・確認済みチェック付き）。パイプライン生成アプリには「議事録」リンクが付き、企画会議の記録（各 AI の企画案・審査スコア・採用理由）を `/app/<slug>/minutes.md` で確認できる。
リポジトリは GitHub Pages でも公開され、ブラウザだけで確認できる。

```bash
npm run dashboard   # 生成後は dashboard/index.html を開く
```

## GitHub 運用

- `main` は常にデプロイ可能な状態だけを置く。作業は `codex/<内容>` ブランチ → PR → main。
- コミットは 1 コミット 1 変更、`feat:` / `fix:` / `refactor:` などのプレフィックス。
- 各 Phase 完了時に `git tag v0.1.0` のようにタグを打つ。
- ロールバック: コードは `git revert`、Worker は `wrangler rollback`、D1 は `wrangler d1 time-travel restore`。
- シークレット（DeepSeek API キー、Cloudflare トークン等）はコミットしない。

## Phase ロードマップ

| Phase | 内容 | 完了条件 |
|---|---|---|
| 0 | 手動 1 本パイプライン（ローカル生成→検証） | 10 本中 7 本以上が見せられる |
| 1 | ギャラリー（Worker + D1 + R2） | 日本語検索・URL 共有が機能 |
| 2 | 自律化（cron・シグナル収集・検証ループ・予算ガード） | 14 日連続無人稼働・成功率 80% 以上 |
| 3 | お題投稿（Turnstile・モデレーション・追跡ページ） | 投稿→公開→追跡が一通り動作 |
| 4 | 流入・収益化 | 実来訪を確認してから検討 |
