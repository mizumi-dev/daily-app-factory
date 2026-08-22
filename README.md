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
