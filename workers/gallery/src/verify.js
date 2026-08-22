// 生成物の検証（機械チェック + AI チェック）
import { chat, FLASH } from "./deepseek.js";

const MAX_BYTES = 200 * 1024;

export function mechanicalCheck(html) {
  const bytes = new TextEncoder().encode(html).length;
  const failures = [];
  const warnings = [];
  if (bytes > MAX_BYTES) failures.push(`サイズ ${bytes}B が 200KB を超えています`);
  if (!/<!doctype html>/i.test(html)) failures.push("<!doctype html> がありません");
  if (!/<\/html>/i.test(html)) failures.push("</html> が見つかりません");
  const external = [
    [/https?:\/\//gi, "外部 URL への参照"],
    [/@import/gi, "@import"],
    [/<link\b/gi, "<link> タグ"],
    [/<script[^>]*\bsrc\s*=/gi, "外部スクリプト"],
    [/\bfetch\s*\(/gi, "fetch 呼び出し"],
    [/\bXMLHttpRequest\b/gi, "XMLHttpRequest"],
    [/\bWebSocket\s*\(/gi, "WebSocket"],
  ];
  for (const [re, label] of external) {
    if (re.test(html)) failures.push(label);
  }
  if (!/<meta[^>]*name=["']viewport["']/i.test(html)) warnings.push("viewport なし");
  if (!/prefers-color-scheme/i.test(html)) warnings.push("ダークモード対応なし");
  if (!/生成日/i.test(html)) warnings.push("フッターに生成日なし");
  return { ok: failures.length === 0, bytes, failures, warnings };
}

function extractJsonArray(text) {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
}

function extractJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function aiCheck(env, spec, html) {
  const system = `あなたは生成アプリの検証担当。企画書の success_check の各項目を、実際の HTML コードから判断して JSON で返してください。
出力形式: {"ok": true|false, "failures": ["未達の項目と理由（日本語、最大3件）"]}
ok は全項目を満たす場合のみ true。
判定ルール:
- コード上で明らかに未達と確認できる場合のみ failures に入れる。推測・可能性レベルの指摘は failures に入れない。
- 「10秒以内」のような時間項目は、操作が即時動作する実装なら合格とする。
- 「ボタンが十分な大きさか」などデザインの好みは、明らかに破綻していなければ合格とする。`;
  const user = `===== 企画書 =====
${JSON.stringify(spec, null, 2)}
===== HTML（先頭 40000 文字） =====
${html.slice(0, 40000)}`;
  const { text } = await chat(env, { model: FLASH, system, user, thinking: false });
  const result = extractJsonObject(text);
  if (!result) return { ok: true, failures: [] };
  return { ok: result.ok === true, failures: Array.isArray(result.failures) ? result.failures : [] };
}

export { extractJsonObject, extractJsonArray };
