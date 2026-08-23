// ハウススタイル規約（config/ の md と同じ内容を Worker に埋め込む）

export const HOUSE_STYLE_V1 = `## 絶対条件
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

export const HOUSE_STYLE_V2 = `## 絶対条件
- 単一 HTML ファイル。CSS・JavaScript はすべてファイル内にインライン。依存パッケージ・ビルド工程なし。
- 外部ネットワークアクセス禁止: fetch / XMLHttpRequest / WebSocket / CDN / 外部フォント / 外部画像は不可。画像は SVG や Canvas で自前描画するか data: URI のみ。
- 状態の保存先は localStorage / URL hash（共有用）/ IndexedDB から企画に応じて選ぶ。保存内容と消える条件を企画書で明示。サーバー送信・cookie は不可。
- 全体を try/catch で保護し、入力が空でも・ストレージが使えない環境でもエラーにならず動くこと。
- ファイルサイズは 200KB 以下。目安は 15〜60KB（機能を削って小さくしすぎない）。

## 表現
- ネットワークを伴わないブラウザ標準 API は積極的に使ってよい: Canvas 2D / WebGL、Web Audio、getUserMedia（カメラ）、Geolocation、Clipboard、Vibration、Fullscreen、File API。
- 権限を要求する API を使う場合は、その理由を UI に 1 文で表示すること。
- 操作のたびに何かが変わる（アニメーション・音・画面変化）フィードバックを 1 つ以上入れること。派手さを恐れない。
- 音を使う場合はミュート手段を設けること。prefers-reduced-motion 時は動きを停止・縮小すること。

## 表示・操作
- ダークモード対応: prefers-color-scheme を必ず扱う。
- モバイル幅（375px）で崩れない。viewport メタタグを必ず含める。
- キーボード操作ができること。
- テキストは読みやすく、日本語表示が崩れないこと。

## 内容
- 実在のブランド名・実在の人物名・既存サービスの模倣を含めない。
- 医療・法律・投資の助言をする機能は含めない。
- フッターに「生成日: YYYY-MM-DD」「お題の出所: ユーザー投稿 / 自動」を必ず記載する。

## 出力ルール
- 出力は完成した HTML コードのみ。コードフェンスや説明文は付けない。
- HTML は <!doctype html> で始め、閉じタグを漏らさない。`;
