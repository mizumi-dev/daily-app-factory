# 日刊アプリ工房 — 開発規約

このリポジトリでは「日刊アプリ工房」（DeepSeek V4 が毎日 1 本、単一 HTML アプリを生成・検証・公開する自律サービス）を開発する。
設計の全体像は [docs/nikkanappkobo-v0.2.pdf](docs/nikkanappkobo-v0.2.pdf) を参照。

## ブランチとコミット

- 作業ブランチは `codex/<内容>`（例: `codex/phase0-pipeline`）。`main` には PR 経由でのみマージする。
- コミットは 1 コミット 1 変更。プレフィックスは `feat:` / `fix:` / `refactor:` / `docs:` / `chore:`。
- 各 Phase の完了時は `git tag v0.x.0` を打つ。

## 絶対に守ること

- API キー・トークン類をコミットしない。ローカルは `.dev.vars`（gitignore 対象）、本番は `wrangler secret put`、CI は GitHub Actions secrets を使う。
- 適用済みの D1 マイグレーションは編集しない。変更は常に新しいマイグレーションとして追加する。

## 生成アプリの扱い

- 公開した単一 HTML は `generated/YYYY-MM-DD-<slug>/index.html` にアーカイブし、Git にコミットしてロールバック可能にする。
- 生成物は外部ネットワークアクセス禁止・状態は localStorage のみ・200KB 以下などのハウススタイル規約に従う。

## Phase 0 の検証チェックリスト

1. ブラウザで開いて動く
2. console に error がない
3. 外部ホストへのリクエストが 0 件
4. 375px 幅で横スクロールしない
5. ファイルサイズ 200KB 以下
6. ダークモード対応・空状態でも動く

## Phase 0 のコマンド

- 生成: `npm run generate -- --brief "お題" [--axis 軸] [--model 企画モデル] [--impl-model 実装モデル]`
- 静的検証: `npm run verify -- generated/YYYY-MM-DD-<slug>/index.html`
- API キーは `.dev.vars`（gitignore 対象）に `DEEPSEEK_API_KEY=sk-...` で置く
- モデル分担: 企画会議 = DeepSeek + 交代制1社（OpenAI / Claude / Gemini）で「お題議論 → 初期提案 → 相互レビュー → 修正案 → DeepSeek Pro 審査」を行う。実装 = `deepseek-v4-flash`（非思考・コスト優先）。実装が2回検証失敗したら最終試行のみ `deepseek-v4-pro`（非思考）へエスカレーション。
- ハウススタイル規約の基本は v2。v1 を使う場合はローカル `--style v1`、パイプライン `{"style":"v1"}` または `HOUSE_STYLE_VERSION=v1`。規約本体は config/house-style*.md を編集し、Worker 側は workers/gallery/src/house-style.js も同期する。
- パイプラインの手動実行（POST /_run）は `"style": "v1"` で v1 制作を指定できる。毎日 cron は既定 v2。

## アプリごとのフィードバック

- 生成アプリへの意見は、そのアプリの `generated/<日付>-<slug>/feedback.md` に1件ずつ記録する。ハウススタイル規約（config/house-style.md）には一般化しない。
- 追加: `npm run feedback -- add <slug> "<意見>"`
- 一覧: `npm run feedback -- list [slug]`
- 対応済みにする: `npm run feedback -- resolve <slug> <番号>`（番号は list で確認）
- 集計一覧は `feedback/index.md` に自動反映される

## ダッシュボード

- 生成アプリの一覧は `npm run dashboard` で `dashboard/index.html` に生成する（GitHub Pages でも公開）。
- アプリを追加・更新したら必ず `npm run dashboard` を実行してからコミットする。

## Phase 1: ギャラリー

- Worker は `workers/gallery/`（D1: DB / R2: APPS）。スキーマは `migrations/`。
- アプリを追加したら `npm run thumbs` → `npm run seed:local` → ローカルで動作確認 → PR。
- 本番投入は `npx wrangler d1 migrations apply daily-app-factory-db --remote --config workers/gallery/wrangler.toml` → `npm run seed` → `npm run deploy`。
- シークレット（API キー等）はコミットしない。D1 の `database_id` はリソース ID であり、`workers/gallery/wrangler.toml` に記載してコミットしてよい。

## Phase 3: お題投稿

- 投稿 API は `POST /api/briefs`（Turnstile → レート制限 → モデレーション → briefs キュー）。追跡は `GET /brief/:token`。
- モデレーションは V4-Flash（非思考）で、攻撃的内容・医療/法律/投資・クローン指定・単一HTML不可能・プロンプトインジェクションを却下。
- Turnstile キーは本番用に必ず差し替える（テストキーは常に通過）。
