#!/usr/bin/env node
// 生成アプリの静的検証（Phase 0 の機械チェック）
// 使い方: node scripts/verify-app.mjs generated/YYYY-MM-DD-slug/index.html
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const MAX_BYTES = 200 * 1024;
const TARGET_BYTES = 40 * 1024;

export function verifyHtml(htmlPath) {
  const bytes = readFileSync(htmlPath).length;
  const html = readFileSync(htmlPath, "utf8");
  const failures = [];
  const warnings = [];

  if (bytes > MAX_BYTES) failures.push(`ファイルサイズ ${bytes} bytes が 200KB を超えています`);
  else if (bytes > TARGET_BYTES) warnings.push(`ファイルサイズ ${bytes} bytes。目安（15〜40KB）を超えています`);

  if (!/<!doctype html>/i.test(html)) failures.push("<!doctype html> がありません");
  if (!/<\/html>/i.test(html)) failures.push("</html> が見つかりません");

  const externalPatterns = [
    [/https?:\/\//gi, "外部 URL（http/https）への参照があります"],
    [/url\(\s*['"]?https?:/gi, "CSS 内に外部 URL があります"],
    [/@import/gi, "@import があります"],
    [/<link\b/gi, "<link> タグがあります（外部リソース禁止）"],
    [/<script[^>]*\bsrc\s*=/gi, "外部スクリプトの読み込みがあります"],
    [/\bfetch\s*\(/gi, "fetch 呼び出しがあります"],
    [/\bXMLHttpRequest\b/gi, "XMLHttpRequest があります"],
    [/\bWebSocket\s*\(/gi, "WebSocket があります"],
  ];
  for (const [re, message] of externalPatterns) {
    if (re.test(html)) failures.push(message);
  }

  if (!/<meta[^>]*name=["']viewport["']/i.test(html)) {
    warnings.push("viewport メタタグがありません");
  }
  if (!/prefers-color-scheme/i.test(html)) warnings.push("ダークモード対応（prefers-color-scheme）がありません");
  if (!/\btry\b[\s\S]{0,200}\bcatch\b/i.test(html)) warnings.push("try/catch が見当たりません");
  if (!/localStorage/i.test(html)) warnings.push("localStorage の使用が見当たりません");
  if (!/生成日/i.test(html)) warnings.push("フッターに「生成日」の記載がありません");
  if (!/お題の出所|ユーザー投稿|自動/i.test(html)) warnings.push("フッターにお題の出所の記載がありません");
  if (!/prefers-reduced-motion/i.test(html)) warnings.push("prefers-reduced-motion への対応が見当たりません");

  return { bytes, failures, warnings };
}

function main() {
  const target = process.argv[2];
  if (!target) {
    console.error("使い方: node scripts/verify-app.mjs <index.html のパス>");
    process.exit(2);
  }
  const result = verifyHtml(target);
  console.log(`対象: ${target}`);
  console.log(`サイズ: ${result.bytes} bytes / 200KB`);
  for (const f of result.failures) console.error(`FAIL: ${f}`);
  for (const w of result.warnings) console.warn(`WARN: ${w}`);
  if (result.failures.length === 0) {
    console.log("結果: OK（警告は目視確認の参考）");
  } else {
    console.error("結果: NG");
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
