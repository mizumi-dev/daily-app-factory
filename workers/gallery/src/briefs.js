// お題投稿 API と追跡ページ
import { verifyTurnstile } from "./turnstile.js";
import { moderateBrief } from "./moderation.js";

const ALLOWED_AXES = ["laugh", "lighten", "productivity"];
const MAX_TEXT_LEN = 300;
const MIN_TEXT_LEN = 10;
const IP_LIMIT = 3;
const GLOBAL_LIMIT = 50;

const STATUS_LABELS = {
  queued: "待機中",
  building: "制作中",
  published: "公開済み",
  rejected: "却下",
  failed: "失敗",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function jstDateAdd(days) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date(Date.now() + days * 86400000));
}

function nextRunDate(position) {
  const hourFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    hour12: false,
  });
  const hour = Number(hourFmt.format(new Date()));
  let offset = hour < 4 ? 0 : 1;
  offset += Math.max(0, position - 1);
  return jstDateAdd(offset);
}

async function queuePosition(env, id) {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM briefs WHERE status='queued' AND id <= ?"
  )
    .bind(id)
    .first();
  return Number(row?.c || 0);
}

export async function submitBrief(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.text !== "string") {
    return json({ error: "text が必要です" }, 400);
  }
  const text = [...body.text].slice(0, MAX_TEXT_LEN).join("");
  if (text.length < MIN_TEXT_LEN) {
    return json({ error: `${MIN_TEXT_LEN}文字以上で入力してください` }, 400);
  }
  const axisHint = ALLOWED_AXES.includes(body.axis_hint) ? body.axis_hint : null;
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";

  const turnstileOk = await verifyTurnstile(
    env.TURNSTILE_SECRET_KEY,
    body.turnstile_token || "",
    ip
  );
  if (!turnstileOk) {
    return json({ error: "bot チェックに失敗しました。再試行してください。" }, 400);
  }

  const date = jstDateAdd(0);
  const ipKey = `rl:ip:${ip}:${date}`;
  const gKey = `rl:g:${date}`;
  const ipCount = Number((await env.CACHE.get(ipKey)) || 0);
  const gCount = Number((await env.CACHE.get(gKey)) || 0);
  if (ipCount >= IP_LIMIT) {
    return json({ error: "1日の投稿上限（3件）に達しました" }, 429);
  }
  if (gCount >= GLOBAL_LIMIT) {
    return json({ error: "本日の投稿は混み合っています。また明日お願いします" }, 429);
  }
  await env.CACHE.put(ipKey, String(ipCount + 1), { expirationTtl: 86400 });
  await env.CACHE.put(gKey, String(gCount + 1), { expirationTtl: 86400 });

  const mod = await moderateBrief(env, text);
  const token = crypto.randomUUID();
  const created = new Date().toISOString();
  const status = mod.ok ? "queued" : "rejected";
  const res = await env.DB.prepare(
    "INSERT INTO briefs (token,text,axis_hint,created_at,status,reject_note) VALUES (?,?,?,?,?,?)"
  )
    .bind(token, text, axisHint, created, status, mod.ok ? null : mod.reason)
    .run();
  const id = res.meta?.last_row_id;
  const position = status === "queued" && id ? await queuePosition(env, id) : null;
  return json({
    token,
    status,
    reason: mod.ok ? null : mod.reason,
    position,
    eta: position ? nextRunDate(position) : null,
    trackingUrl: `/brief/${token}`,
  });
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function briefPage(request, env, pathname) {
  const token = decodeURIComponent(pathname.slice("/brief/".length));
  const b = await env.DB.prepare("SELECT * FROM briefs WHERE token=?").bind(token).first();
  if (!b) {
    return new Response("<!doctype html><meta charset=utf-8><title>404</title><h1>404 Not Found</h1>", {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  let position = null;
  let eta = null;
  if (b.status === "queued" && b.id) {
    position = await queuePosition(env, b.id);
    eta = nextRunDate(position);
  }
  const html = `<!doctype html>
<html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>お題の追跡 — 日刊アプリ工房</title>
<style>
:root{--bg:#0f0e17;--text:#e8e4da;--soft:#9c9487;--accent:#ff8c42;--panel:rgba(255,255,255,0.05);--border:rgba(255,255,255,0.1)}
@media(prefers-color-scheme:light){:root{--bg:#faf6ee;--text:#2f2b26;--soft:#7c7466;--panel:rgba(0,0,0,0.05);--border:rgba(0,0,0,0.12)}}
*{box-sizing:border-box;margin:0;padding:0}body{font-family:"Hiragino Sans","Yu Gothic",Meiryo,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.card{max-width:560px;width:100%;background:var(--panel);border:1px solid var(--border);border-radius:18px;padding:28px}
h1{font-size:1.25rem;margin-bottom:16px}.label{font-size:0.75rem;color:var(--soft);margin-top:14px}
.quote{border-left:3px solid var(--accent);padding:8px 14px;margin-top:6px;font-size:0.95rem;white-space:pre-wrap}
.badge{display:inline-block;margin-top:10px;padding:4px 14px;border-radius:999px;font-size:0.82rem;font-weight:600;background:rgba(255,140,66,0.15);color:#ffb27a;border:1px solid rgba(255,140,66,0.4)}
.meta{font-size:0.85rem;color:var(--soft);margin-top:8px}
a{color:var(--accent)}</style></head>
<body><div class="card">
<h1>お題の追跡ページ</h1>
<div class="label">投稿内容</div>
<div class="quote">${esc(b.text)}</div>
<div class="badge">${STATUS_LABELS[b.status] || b.status}</div>
${b.status === "rejected" ? `<div class="meta">却下理由: ${esc(b.reject_note || "")}</div>` : ""}
${b.status === "queued" ? `<div class="meta">待ち行列: ${position} 件目 / 着手予定: ${eta} 04:00 JST</div>` : ""}
${b.status === "published" ? `<div class="meta">完成しました: <a href="/app/${esc(b.result_slug)}">${esc(b.result_slug)}</a></div>` : ""}
${b.status === "building" ? `<div class="meta">ただいま制作中です。</div>` : ""}
${b.status === "failed" ? `<div class="meta">生成に失敗しました。申し訳ありません。</div>` : ""}
<div class="meta">投稿日時: ${esc(String(b.created_at).replace("T", " ").slice(0, 16))} JST</div>
<div class="meta"><a href="/">← ギャラリーへ戻る</a></div>
</div></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
