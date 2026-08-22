// ハウススタイル規約（config/house-style.md と同じ内容を Worker に埋め込む）

export const HOUSE_STYLE = `## 絶対条件
- 単一 HTML ファイル。CSS・JavaScript はすべてファイル内にインライン。
- 外部ネットワークアクセス禁止: fetch / XMLHttpRequest / WebSocket / CDN / 外部フォント / 外部画像は不可。画像は SVG や Canvas で自前描画するか data: URI のみ。
- 依存パッケージ・ビルド工程なし。そのままブラウザで開いて動くこと。
- 状態は localStorage のみ。サーバー送信・cookie は不可。
- 全体を try/catch で保護し、入力が空でもエラーにならず動くこと。
- ファイルサイズは 200KB 以下。目安は 15〜40KB。

## 表示・操作
- ダークモード対応: prefers-color-scheme を必ず扱う。
- モバイル幅（375px）で崩れない。viewport メタタグを必ず含める。
- キーボード操作ができること。
- prefers-reduced-motion を尊重する。

## 内容
- 実在のブランド名・実在の人物名・既存サービスの模倣を含めない。
- 医療・法律・投資の助言をする機能は含めない。
- フッターに「生成日: YYYY-MM-DD」「お題の出所: ユーザー投稿 / 自動」を必ず記載する。

## 出力ルール
- 出力は完成した HTML コードのみ。コードフェンスや説明文は付けない。
- HTML は <!doctype html> で始め、閉じタグを漏らさない。`;
