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

- 生成: `npm run generate -- --brief "お題" [--axis 軸] [--model deepseek-v4-pro]`
- 静的検証: `npm run verify -- generated/YYYY-MM-DD-<slug>/index.html`
- API キーは `.dev.vars`（gitignore 対象）に `DEEPSEEK_API_KEY=sk-...` で置く
