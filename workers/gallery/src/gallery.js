// ギャラリーの SSR レンダリング
import { AXIS_LABELS, AXIS_COLORS, plannerLabel } from "./store.js";

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtBytes(n) {
  return n >= 1024 ? (n / 1024).toFixed(1) + "KB" : n + "B";
}

function buildQuery(params) {
  const p = new URLSearchParams();
  if (params.q) p.set("q", params.q);
  if (params.axis) p.set("axis", params.axis);
  if (params.tag) p.set("tag", params.tag);
  if (params.origin) p.set("origin", params.origin);
  if (params.sort && params.sort !== "new") p.set("sort", params.sort);
  return p.toString();
}

function card(app) {
  const color = AXIS_COLORS[app.axis] || "#999";
  const plannerText = app.planner
    ? `企画: ${plannerLabel(app.planner)}${app.adopted_planner ? `（${plannerLabel(app.adopted_planner)}案採用）` : ""}`
    : "";
  const minutesLink = app.has_minutes ? `<a class="minutes" href="/app/${esc(app.slug)}/minutes.md">議事録</a>` : "";
  return `<article class="card">
    <a class="thumb" href="/app/${esc(app.slug)}" target="_blank" rel="noopener">
      <img src="/app/${esc(app.slug)}/thumb.svg" alt="${esc(app.title)}のサムネイル" loading="lazy" width="600" height="315">
    </a>
    <div class="card-body">
      <div class="card-top">
        <span class="axis-badge" style="background:${color}">${esc(AXIS_LABELS[app.axis] || app.axis)}</span>
        <span class="origin">${app.origin === "auto" ? "自動" : "ユーザー投稿"}</span>
      </div>
      <h2><a href="/app/${esc(app.slug)}" target="_blank" rel="noopener">${esc(app.title)}</a></h2>
      <p class="tagline">${esc(app.tagline)}</p>
      <div class="tags">${app.tags.slice(0, 3).map((t) => `<a class="tag" href="/?tag=${esc(encodeURIComponent(t))}">${esc(t)}</a>`).join("")}</div>
      <div class="meta">${minutesLink}${plannerText ? `<span>${esc(plannerText)}</span>` : ""}<span>${esc(app.published_at.slice(0, 10))}</span><span>${fmtBytes(app.bytes)}</span></div>
    </div>
  </article>`;
}

export function renderGallery({ apps, total, page, perPage, params, facets, siteKey }) {
  const qs = buildQuery(params);
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const axisKeys = Object.keys(AXIS_LABELS);
  const activeAxes = (params.axis || "").split(",").filter(Boolean);

  const axisChips = axisKeys
    .map((a) => {
      const on = activeAxes.includes(a);
      const next = on ? activeAxes.filter((x) => x !== a) : [...activeAxes, a];
      const p = { ...params, axis: next.join(",") };
      if (!p.axis) delete p.axis;
      return `<a class="chip${on ? " on" : ""}" href="/?${buildQuery(p)}">${AXIS_LABELS[a]}</a>`;
    })
    .join("");

  const tagFacets = (facets.tags || [])
    .map((t) => {
      const on = params.tag === t.tag;
      const p = { ...params };
      if (on) delete p.tag;
      else p.tag = t.tag;
      return `<a class="chip${on ? " on" : ""}" href="/?${buildQuery(p)}">${esc(t.tag)} (${t.c})</a>`;
    })
    .join("");

  const originFacets = (facets.origins || [])
    .map((o) => {
      const on = params.origin === o.origin;
      const p = { ...params };
      if (on) delete p.origin;
      else p.origin = o.origin;
      const label = o.origin === "auto" ? "自動" : "ユーザー投稿";
      return `<a class="chip${on ? " on" : ""}" href="/?${buildQuery(p)}">${label} (${o.c})</a>`;
    })
    .join("");

  const prevHref = page > 1 ? `/?${buildQuery({ ...params, page: page - 1 })}` : "";
  const nextHref = page < totalPages ? `/?${buildQuery({ ...params, page: page + 1 })}` : "";
  const hasFilter = qs !== "";

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>日刊アプリ工房 — ギャラリー</title>
<meta name="description" content="AI が毎日1本作る、動く単一 HTML アプリのギャラリー。検索・ソート・フィルタできます。">
<style>
:root{--bg:#0f0e17;--bg-soft:#17161f;--panel:rgba(255,255,255,0.045);--text:#e8e4da;--text-soft:#9c9487;--accent:#ff8c42;--border:rgba(255,255,255,0.09)}
@media(prefers-color-scheme:light){:root{--bg:#faf6ee;--bg-soft:#f2ecdf;--panel:rgba(0,0,0,0.045);--text:#2f2b26;--text-soft:#7c7466;--border:rgba(0,0,0,0.12)}}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:"Hiragino Sans","Yu Gothic",Meiryo,"Noto Sans JP",sans-serif;background:var(--bg);color:var(--text);min-height:100%;line-height:1.6}
.wrap{max-width:1080px;margin:0 auto;padding:24px 16px 48px}
header{text-align:center;margin-bottom:18px}
h1{font-size:clamp(1.4rem,4.6vw,1.8rem)}.sub{color:var(--text-soft);font-size:0.9rem;margin-top:4px}
.controls{display:flex;flex-wrap:wrap;gap:10px;align-items:center;background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:12px 14px;margin-bottom:14px}
form.search-form{display:flex;gap:8px;flex:1 1 300px}
input.search{flex:1;min-width:160px;background:var(--bg-soft);border:1.5px solid var(--border);border-radius:10px;padding:9px 14px;font-size:0.92rem;color:var(--text);outline:none}
input.search:focus{border-color:var(--accent)}
select.sort{background:var(--bg-soft);border:1.5px solid var(--border);border-radius:10px;padding:8px 10px;font-size:0.85rem;color:var(--text);font-family:inherit;outline:none}
.chips{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:10px}
.chip{border:1px solid var(--border);background:transparent;color:var(--text-soft);border-radius:999px;padding:4px 11px;font-size:0.78rem;text-decoration:none;transition:all .18s ease}
.chip:hover{border-color:var(--accent);color:var(--text)}.chip.on{background:var(--accent);border-color:var(--accent);color:#1a130a;font-weight:600}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.card{background:var(--panel);border:1px solid var(--border);border-radius:16px;overflow:hidden;display:flex;flex-direction:column;transition:transform .15s ease,box-shadow .2s ease}
.card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.18)}
.thumb{display:block;aspect-ratio:600/315;overflow:hidden;background:var(--bg-soft)}
.thumb img{width:100%;height:100%;object-fit:cover;display:block}
.card-body{padding:14px 16px 16px;display:flex;flex-direction:column;gap:7px}
.card-top{display:flex;align-items:center;gap:8px}
.axis-badge{font-size:0.7rem;font-weight:700;padding:3px 10px;border-radius:999px;color:#111}
.origin{font-size:0.72rem;color:var(--text-soft)}
h2{font-size:1.02rem;line-height:1.4}h2 a{color:inherit;text-decoration:none}h2 a:hover{color:var(--accent)}
.tagline{color:var(--text-soft);font-size:0.85rem;min-height:2.6em}
.tags{display:flex;flex-wrap:wrap;gap:5px}.tag{font-size:0.72rem;color:var(--text-soft);background:var(--bg-soft);border:1px solid var(--border);border-radius:999px;padding:2px 9px;text-decoration:none}.tag:hover{color:var(--accent)}
.meta{display:flex;gap:8px;font-size:0.75rem;color:var(--text-soft);margin-top:auto}
.meta a{color:var(--accent);text-decoration:none}.meta a:hover{text-decoration:underline}
.empty{text-align:center;color:var(--text-soft);padding:48px 0}
.pager{display:flex;justify-content:center;gap:14px;margin-top:22px}
.pager a{color:var(--accent);text-decoration:none;border:1px solid var(--border);border-radius:999px;padding:7px 18px}
.clear{display:inline-block;margin-bottom:8px;font-size:0.8rem;color:var(--accent)}
.brief-box{background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:16px 18px;margin-bottom:16px}
.brief-box h2{font-size:1rem;margin-bottom:2px}
.brief-box .sub{color:var(--text-soft);font-size:0.8rem;margin-bottom:10px}
#briefForm{display:flex;flex-direction:column;gap:10px}
#briefForm textarea{width:100%;min-height:74px;background:var(--bg-soft);border:1.5px solid var(--border);border-radius:10px;padding:10px 12px;font-size:0.9rem;color:var(--text);font-family:inherit;resize:vertical;outline:none}
#briefForm textarea:focus{border-color:var(--accent)}
#briefForm .row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
#briefForm select{background:var(--bg-soft);border:1.5px solid var(--border);border-radius:10px;padding:8px 10px;font-size:0.85rem;color:var(--text);font-family:inherit}
#briefForm .btn-submit{background:var(--accent);color:#1a130a;border:none;border-radius:999px;padding:10px 22px;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit}
#briefForm .btn-submit:hover{filter:brightness(1.08)}
#briefResult{font-size:0.85rem;margin-top:8px;color:var(--text-soft)}
#briefResult a{color:var(--accent)}
footer{margin-top:30px;text-align:center;font-size:0.75rem;color:var(--text-soft);opacity:0.7}
@media(max-width:480px){.grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>日刊アプリ工房</h1>
    <p class="sub">AI が毎日 1 本作る、動く単一 HTML アプリのギャラリー（全 ${total} 本）</p>
  </header>
  <section class="brief-box">
    <h2>お題を投げる</h2>
    <p class="sub">AI が次の制作で優先的に作ります（1日1本・投稿順）。追跡ページで進み具合を見られます。</p>
    <form id="briefForm">
      <textarea id="briefText" minlength="10" maxlength="300" placeholder="10〜300文字でお題を書いてください（例: 3分後にそっと消えるメモ）" aria-label="お題" required></textarea>
      <div class="row">
        <select id="briefAxis" aria-label="軸">
          <option value="">軸はおまかせ</option>
          <option value="laugh">笑わせる</option>
          <option value="lighten">心を軽くする</option>
          <option value="productivity">生産性</option>
        </select>
        <div class="cf-turnstile" data-sitekey="${esc(siteKey)}" data-callback="onTurnstileReady"></div>
        <button class="btn-submit" type="submit">投稿する</button>
      </div>
    </form>
    <p id="briefResult" role="status"></p>
  </section>
  <section class="controls">
    <form class="search-form" method="get" action="/">
      <input class="search" type="search" name="q" value="${esc(params.q || "")}" placeholder="タイトル・タグライン・タグで検索" aria-label="検索">
      <input type="hidden" name="axis" value="${esc(params.axis || "")}">
      <input type="hidden" name="tag" value="${esc(params.tag || "")}">
      <input type="hidden" name="origin" value="${esc(params.origin || "")}">
      <input type="hidden" name="sort" value="${esc(params.sort || "new")}">
      <select class="sort" name="sort" id="sort" aria-label="並び順" data-auto="1">
        <option value="new"${params.sort === "new" ? " selected" : ""}>新しい順</option>
        <option value="old"${params.sort === "old" ? " selected" : ""}>古い順</option>
        <option value="popular"${params.sort === "popular" ? " selected" : ""}>人気順</option>
        <option value="loved"${params.sort === "loved" ? " selected" : ""}>リアクション順</option>
        <option value="rising"${params.sort === "rising" ? " selected" : ""}>急上昇</option>
        <option value="random"${params.sort === "random" ? " selected" : ""}>ランダム</option>
      </select>
    </form>
  </section>
  <nav class="chips" aria-label="軸フィルタ">${axisChips}</nav>
  ${tagFacets ? `<nav class="chips" aria-label="タグフィルタ">${tagFacets}</nav>` : ""}
  ${originFacets ? `<nav class="chips" aria-label="出所フィルタ">${originFacets}</nav>` : ""}
  ${hasFilter ? `<a class="clear" href="/">すべてのフィルタを解除</a>` : ""}
  <section class="grid">
    ${apps.length ? apps.map(card).join("") : `<p class="empty">該当するアプリがありません。</p>`}
  </section>
  <nav class="pager" aria-label="ページ送り">
    ${prevHref ? `<a rel="prev" href="${prevHref}">← 前へ</a>` : ""}
    <span class="sub">${page} / ${totalPages}</span>
    ${nextHref ? `<a rel="next" href="${nextHref}">次へ →</a>` : ""}
  </nav>
  <footer>日刊アプリ工房 · このサイトのアプリは AI が自動生成しています</footer>
</div>
<script>
var turnstileToken = "";
function onTurnstileReady(t){ turnstileToken = t; }
document.getElementById("briefForm").addEventListener("submit", async function(e){
  e.preventDefault();
  var res = document.getElementById("briefResult");
  res.textContent = "送信中...";
  try {
    var resp = await fetch("/api/briefs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: document.getElementById("briefText").value,
        axis_hint: document.getElementById("briefAxis").value,
        turnstile_token: turnstileToken
      })
    });
    var data = await resp.json();
    if (!resp.ok) { res.textContent = data.error || "エラーが発生しました"; return; }
    if (data.status === "rejected") {
      res.textContent = "このお題は却下されました: " + (data.reason || "");
      return;
    }
    res.textContent = "受け付けました（待ち " + data.position + " 件目・着手予定 " + data.eta + "）。";
    var a = document.createElement("a");
    a.href = data.trackingUrl;
    a.textContent = "追跡ページを開く";
    res.appendChild(document.createTextNode(" "));
    res.appendChild(a);
  } catch (err) {
    res.textContent = "通信エラーが発生しました。再試行してください。";
  }
});
document.getElementById("sort").addEventListener("change", function(){
  var u = new URL(location.href);
  u.searchParams.set("sort", this.value);
  u.searchParams.delete("page");
  location.href = u;
});
</script>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
</body>
</html>`;
}
