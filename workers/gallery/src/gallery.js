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
  if (params.page && params.page > 1) p.set("page", params.page);
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
        <button class="fav-btn" data-fav="${esc(app.slug)}" aria-label="お気に入り" type="button">♥</button>
      </div>
      <h2><a href="/app/${esc(app.slug)}" target="_blank" rel="noopener">${esc(app.title)}</a></h2>
      <p class="tagline">${esc(app.tagline)}</p>
      <div class="tags">${app.tags.slice(0, 3).map((t) => `<a class="tag" href="/?tag=${esc(encodeURIComponent(t))}">${esc(t)}</a>`).join("")}</div>
      <div class="meta">${minutesLink}${plannerText ? `<span>${esc(plannerText)}</span>` : ""}<span>${esc(app.published_at.slice(0, 10))}</span><span>${fmtBytes(app.bytes)}</span></div>
      <div class="card-actions">
        <button class="btn" data-preview="/app/${esc(app.slug)}" data-title="${esc(app.title)}" type="button">プレビュー</button>
        <a class="btn" href="/app/${esc(app.slug)}" target="_blank" rel="noopener">開く</a>
        <label class="review"><input type="checkbox" data-review="${esc(app.slug)}">確認済み</label>
      </div>
    </div>
  </article>`;
}

export function renderGallery({ apps, total, page, perPage, params, facets, siteKey, style }) {
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
      delete p.page;
      return `<a class="chip${on ? " on" : ""}" href="/?${buildQuery(p)}">${AXIS_LABELS[a]}</a>`;
    })
    .join("");

  const tagFacets = (facets.tags || [])
    .map((t) => {
      const on = params.tag === t.tag;
      const p = { ...params };
      if (on) delete p.tag;
      else p.tag = t.tag;
      delete p.page;
      return `<a class="chip${on ? " on" : ""}" href="/?${buildQuery(p)}">${esc(t.tag)} (${t.c})</a>`;
    })
    .join("");

  const originFacets = (facets.origins || [])
    .map((o) => {
      const on = params.origin === o.origin;
      const p = { ...params };
      if (on) delete p.origin;
      else p.origin = o.origin;
      delete p.page;
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
.fav-btn{background:transparent;border:none;color:var(--text-soft);font-size:1rem;line-height:1;cursor:pointer;margin-left:auto;padding:2px 4px;transition:transform .15s ease}
.fav-btn:hover{color:var(--accent);transform:scale(1.15)}.fav-btn.on{color:#ff5b7f}
h2{font-size:1.02rem;line-height:1.4}h2 a{color:inherit;text-decoration:none}h2 a:hover{color:var(--accent)}
.tagline{color:var(--text-soft);font-size:0.85rem;min-height:2.6em}
.tags{display:flex;flex-wrap:wrap;gap:5px}.tag{font-size:0.72rem;color:var(--text-soft);background:var(--bg-soft);border:1px solid var(--border);border-radius:999px;padding:2px 9px;text-decoration:none}.tag:hover{color:var(--accent)}
.meta{display:flex;gap:8px;font-size:0.75rem;color:var(--text-soft);margin-top:auto}
.meta a{color:var(--accent);text-decoration:none}.meta a:hover{text-decoration:underline}
.card-actions{display:flex;gap:8px;align-items:center;margin-top:4px;flex-wrap:wrap}
.card-actions .btn{flex:1;text-align:center;text-decoration:none;border:1.5px solid var(--border);background:transparent;color:var(--text);border-radius:999px;padding:7px 0;font-size:0.82rem;cursor:pointer;font-family:inherit;transition:all .18s ease;min-width:70px}
.card-actions .btn:hover{border-color:var(--accent);color:var(--accent)}
.review{display:flex;align-items:center;gap:6px;font-size:0.8rem;color:var(--text-soft);cursor:pointer;user-select:none}
.review input{accent-color:#7fd6a8;width:15px;height:15px;cursor:pointer}
.review.done{color:#7fd6a8}
.empty{text-align:center;color:var(--text-soft);padding:48px 0}
.pager{display:flex;justify-content:center;gap:14px;margin-top:22px}
.pager a{color:var(--accent);text-decoration:none;border:1px solid var(--border);border-radius:999px;padding:7px 18px}
.clear{display:inline-block;margin-bottom:8px;font-size:0.8rem;color:var(--accent)}
.modal{position:fixed;inset:0;background:rgba(0,0,0,0.72);display:none;align-items:center;justify-content:center;z-index:50;padding:20px}.modal.open{display:flex}
.modal-box{width:min(880px,100%);height:min(760px,90vh);background:var(--bg);border-radius:16px;overflow:hidden;display:flex;flex-direction:column;border:1px solid var(--border)}
.modal-head{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:var(--bg-soft)}.modal-title{font-size:0.9rem;font-weight:600}.modal-close{border:1px solid var(--border);background:transparent;color:var(--text);border-radius:999px;padding:5px 14px;cursor:pointer;font-family:inherit}
.modal-frame{flex:1;border:0;width:100%;background:#fff}
.brief-box{background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:16px 18px;margin-bottom:16px}
.style-badge{display:inline-block;margin-top:8px;font-size:0.72rem;color:var(--text-soft);border:1px solid var(--border);border-radius:999px;padding:3px 12px}
.style-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center;margin-top:8px}
.style-select{background:var(--bg-soft);border:1.5px solid var(--border);border-radius:10px;padding:4px 8px;font-size:0.78rem;color:var(--text);font-family:inherit;outline:none}
.style-msg{font-size:0.75rem;color:var(--text-soft)}
.progress-wrap{margin:12px auto 0;max-width:420px}.progress-bar{height:8px;border-radius:999px;background:var(--panel);overflow:hidden}.progress-fill{height:100%;width:0%;background:linear-gradient(90deg,#ff8c42,#ffb347);border-radius:999px;transition:width .3s ease}.progress-label{font-size:0.78rem;color:var(--text-soft);margin-top:6px}
.owner-box{background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:12px 16px;margin-bottom:16px}
.owner-box summary{cursor:pointer;font-size:0.9rem;font-weight:600;color:var(--text-soft)}
.owner-box summary:hover{color:var(--accent)}
.owner-box .sub{color:var(--text-soft);font-size:0.78rem;margin:6px 0}
.owner-box textarea{width:100%;min-height:64px;background:var(--bg-soft);border:1.5px solid var(--border);border-radius:10px;padding:10px 12px;font-size:0.9rem;color:var(--text);font-family:inherit;resize:vertical;outline:none}
.owner-box textarea:focus{border-color:var(--accent)}
.owner-row{display:flex;gap:10px;align-items:center;margin-top:8px;flex-wrap:wrap}
.owner-row .btn-submit{background:var(--accent);color:#1a130a;border:none;border-radius:999px;padding:8px 20px;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit}
.owner-row .btn-submit:hover{filter:brightness(1.08)}
#ownerMsg{font-size:0.8rem;color:var(--text-soft)}#ownerMsg a{color:var(--accent)}
.fav-bar{display:none;justify-content:center;align-items:center;gap:10px;margin-bottom:10px;font-size:0.8rem;color:var(--text-soft)}
.fav-bar a{color:var(--accent)}
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
@media(max-width:480px){.grid{grid-template-columns:1fr}.modal{padding:8px}}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>日刊アプリ工房</h1>
    <p class="sub">AI が毎日 1 本作る、動く単一 HTML アプリのギャラリー（全 ${total} 本）</p>
    <div class="style-row">
      <span class="style-badge" style="margin:0">ハウススタイル: <b id="styleNow">${esc(style || "v2")}</b></span>
      <select id="styleSelect" class="style-select" aria-label="ハウススタイル規約の切替">
        <option value="v1">v1（基本）</option>
        <option value="v2">v2（緩め・既定）</option>
        <option value="v3">v3（厳しめ）</option>
      </select>
      <span class="style-msg" id="styleMsg" role="status"></span>
    </div>
    <div class="progress-wrap">
      <div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>
      <p class="progress-label" id="progressLabel"></p>
    </div>
  </header>
  <details class="owner-box">
    <summary>オーナー用: プロンプトから直接生成</summary>
    <p class="sub">管理トークンが必要です（初回のみ入力・ブラウザに保存）。実行すると即座に生成・公開されます（1回あたり数セント程度）。</p>
    <textarea id="ownerPrompt" maxlength="300" placeholder="例: 3分後にそっと消えるメモ（最大300文字）" aria-label="オーナー用プロンプト"></textarea>
    <div class="owner-row">
      <button id="ownerRun" class="btn-submit" type="button">生成する</button>
      <span id="ownerMsg" role="status"></span>
    </div>
  </details>
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
      <button class="chip" id="favChip" type="button">♥ お気に入り</button>
    </form>
  </section>
  <nav class="chips" aria-label="軸フィルタ">${axisChips}</nav>
  ${tagFacets ? `<nav class="chips" aria-label="タグフィルタ">${tagFacets}</nav>` : ""}
  ${originFacets ? `<nav class="chips" aria-label="出所フィルタ">${originFacets}</nav>` : ""}
  ${hasFilter ? `<a class="clear" href="/">すべてのフィルタを解除</a>` : ""}
  <div class="fav-bar" id="favBar"><span>♥ お気に入り表示中（全アプリから）</span><a href="/">すべて表示に戻る</a></div>
  <section class="grid" id="galleryGrid">
    ${apps.length ? apps.map(card).join("") : `<p class="empty">該当するアプリがありません。</p>`}
  </section>
  <nav class="pager" id="galleryPager" aria-label="ページ送り">
    ${prevHref ? `<a rel="prev" href="${prevHref}">← 前へ</a>` : ""}
    <span class="sub">${page} / ${totalPages}</span>
    ${nextHref ? `<a rel="next" href="${nextHref}">次へ →</a>` : ""}
  </nav>
  <footer>日刊アプリ工房 · このサイトのアプリは AI が自動生成しています</footer>
</div>
<div class="modal" id="modal" role="dialog" aria-modal="true" aria-label="アプリプレビュー">
  <div class="modal-box">
    <div class="modal-head">
      <span class="modal-title" id="modalTitle"></span>
      <button class="modal-close" id="modalClose" type="button">閉じる</button>
    </div>
    <iframe class="modal-frame" id="modalFrame" sandbox="allow-scripts" title="アプリプレビュー"></iframe>
  </div>
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
// お気に入り（localStorage）
var FAV_KEY = "daf-fav-v1";
var favs = (function(){ try { return JSON.parse(localStorage.getItem(FAV_KEY) || "{}"); } catch(e){ return {}; } })();
function saveFavs(){ try { localStorage.setItem(FAV_KEY, JSON.stringify(favs)); } catch(e){} }
function esc(s){ return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }
document.querySelectorAll("[data-fav]").forEach(function(b){
  if (favs[b.getAttribute("data-fav")]) b.classList.add("on");
});
document.addEventListener("click", function(e){
  var b = e.target.closest ? e.target.closest("[data-fav]") : null;
  if (!b) return;
  var slug = b.getAttribute("data-fav");
  var on = favs[slug];
  if (on) { delete favs[slug]; b.classList.remove("on"); b.setAttribute("aria-label", "お気に入り"); }
  else { favs[slug] = 1; b.classList.add("on"); b.setAttribute("aria-label", "お気に入り解除"); }
  saveFavs();
  var bar = document.getElementById("favBar");
  if (!on && bar && bar.style.display === "flex") {
    var card = b.closest(".card");
    if (card) card.remove();
  }
});
// お気に入り一覧（全アプリから取得して表示）
var AXIS_C = { laugh:"#ffb347", lighten:"#7fd6a8", productivity:"#4da3ff", insight:"#c79bff", decide:"#ff8c66", wonder:"#5be0d6", duo:"#ff7fc3" };
var AXIS_L = { laugh:"笑わせる", lighten:"心を軽くする", productivity:"生産性", insight:"気づき", decide:"決める", wonder:"好奇心", duo:"ふたりで" };
var PL = { deepseek:"DeepSeek", openai:"OpenAI", anthropic:"Claude", gemini:"Gemini" };
function pLabel(p){ return String(p || "").split("+").map(function(x){ return PL[x] || x; }).join("+"); }
function fmtB(n){ return n >= 1024 ? (n / 1024).toFixed(1) + "KB" : n + "B"; }
function favCard(a){
  var color = AXIS_C[a.axis] || "#999";
  var planner = a.planner ? "企画: " + pLabel(a.planner) + (a.adopted_planner ? "（" + pLabel(a.adopted_planner) + "案採用）" : "") : "";
  var mins = a.has_minutes ? '<a class="minutes" href="/app/' + esc(a.slug) + '/minutes.md">議事録</a>' : "";
  return '<article class="card">' +
    '<a class="thumb" href="/app/' + esc(a.slug) + '" target="_blank" rel="noopener"><img src="/app/' + esc(a.slug) + '/thumb.svg" alt="' + esc(a.title) + 'のサムネイル" loading="lazy" width="600" height="315"></a>' +
    '<div class="card-body"><div class="card-top"><span class="axis-badge" style="background:' + color + '">' + esc(AXIS_L[a.axis] || a.axis) + '</span>' +
    '<span class="origin">' + (a.origin === "auto" ? "自動" : "ユーザー投稿") + '</span>' +
    '<button class="fav-btn on" data-fav="' + esc(a.slug) + '" aria-label="お気に入り解除" type="button">♥</button></div>' +
    '<h2><a href="/app/' + esc(a.slug) + '" target="_blank" rel="noopener">' + esc(a.title) + '</a></h2>' +
    '<p class="tagline">' + esc(a.tagline || "") + '</p>' +
    '<div class="tags">' + (a.tags || []).slice(0, 3).map(function(t){ return '<span class="tag">' + esc(t) + '</span>'; }).join("") + '</div>' +
    '<div class="meta">' + mins + (planner ? '<span>' + esc(planner) + '</span>' : "") + '<span>' + esc((a.published_at || "").slice(0, 10)) + '</span><span>' + fmtB(a.bytes) + '</span></div>' +
    '<div class="card-actions">' +
      '<button class="btn" data-preview="/app/' + esc(a.slug) + '" data-title="' + esc(a.title) + '" type="button">プレビュー</button>' +
      '<a class="btn" href="/app/' + esc(a.slug) + '" target="_blank" rel="noopener">開く</a>' +
      '<label class="review"><input type="checkbox" data-review="' + esc(a.slug) + '">確認済み</label>' +
    '</div>' +
    '</div></article>';
}
document.getElementById("favChip").addEventListener("click", function(){
  var grid = document.getElementById("galleryGrid");
  var bar = document.getElementById("favBar");
  if (bar.style.display === "flex") { location.href = "/"; return; }
  grid.innerHTML = '<p class="empty">読み込み中...</p>';
  fetch("/api/apps?per_page=200").then(function(r){ return r.json(); }).then(function(d){
    if (d && Array.isArray(d.apps)) ALL_APPS = d.apps;
    var list = (d && d.apps || []).filter(function(a){ return favs[a.slug]; });
    bar.style.display = "flex";
    document.getElementById("galleryPager").style.display = "none";
    grid.innerHTML = list.length ? list.map(favCard).join("") : '<p class="empty">お気に入りはまだありません。カードの ♥ を押すと追加できます。</p>';
  }).catch(function(){ grid.innerHTML = '<p class="empty">読み込みに失敗しました。</p>'; });
});
// オーナー用プロンプト（管理トークン必須）
document.getElementById("ownerRun").addEventListener("click", function(){
  var text = document.getElementById("ownerPrompt").value.trim();
  var msg = document.getElementById("ownerMsg");
  if (!text) { msg.textContent = "プロンプトを入力してください"; return; }
  var token = "";
  try { token = localStorage.getItem("daf-admin-token") || ""; } catch(e){}
  if (!token) {
    token = window.prompt("管理トークン（ADMIN_TOKEN）を入力してください");
    if (!token) { msg.textContent = "キャンセルしました"; return; }
    try { localStorage.setItem("daf-admin-token", token); } catch(e){}
  }
  msg.textContent = "生成中です（数分かかります）...";
  fetch("/_run", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": token },
    body: JSON.stringify({ brief: text, style: "" })
  }).then(function(r){
    return r.json().catch(function(){ return {}; }).then(function(d){ return { ok: r.ok, status: r.status, d: d }; });
  }).then(function(res){
    if (res.ok && res.d && res.d.published) {
      msg.innerHTML = '公開しました: <a href="/app/' + esc(res.d.published) + '" target="_blank" rel="noopener">' + esc(res.d.published) + '</a>';
      document.getElementById("ownerPrompt").value = "";
    } else if (res.status === 403) {
      try { localStorage.removeItem("daf-admin-token"); } catch(e){}
      msg.textContent = "管理トークンが無効です。もう一度お試しください。";
    } else {
      msg.textContent = "エラー: " + (res.d.error || res.status);
    }
  }).catch(function(){ msg.textContent = "通信エラーが発生しました"; });
});
// 確認済み管理 + 進捗（全アプリから集計）
var REVIEW_KEY = "daf-review-v1";
var review = (function(){ try { return JSON.parse(localStorage.getItem(REVIEW_KEY) || "{}"); } catch(e){ return {}; } })();
function saveReview(){ try { localStorage.setItem(REVIEW_KEY, JSON.stringify(review)); } catch(e){} }
var ALL_APPS = null;
function updateProgress(){
  if (!ALL_APPS || !ALL_APPS.length) { document.getElementById("progressLabel").textContent = ""; return; }
  var done = ALL_APPS.filter(function(a){ return review[a.slug]; }).length;
  var pct = Math.round(done / ALL_APPS.length * 100);
  document.getElementById("progressFill").style.width = pct + "%";
  document.getElementById("progressLabel").textContent = "確認済み: " + done + " / " + ALL_APPS.length + "（" + pct + "%）";
}
document.querySelectorAll("[data-review]").forEach(function(c){
  if (review[c.getAttribute("data-review")]) {
    c.checked = true;
    var l = c.closest(".review");
    if (l) l.classList.add("done");
  }
});
document.addEventListener("change", function(e){
  var c = e.target.closest ? e.target.closest("[data-review]") : null;
  if (!c) return;
  review[c.getAttribute("data-review")] = c.checked;
  saveReview();
  var l = c.closest(".review");
  if (l) l.classList.toggle("done", c.checked);
  updateProgress();
});
fetch("/api/apps?per_page=200").then(function(r){ return r.json(); }).then(function(d){
  if (d && Array.isArray(d.apps) && d.apps.length) { ALL_APPS = d.apps; updateProgress(); }
}).catch(function(){});
// プレビューモーダル
var modal = document.getElementById("modal");
var modalFrame = document.getElementById("modalFrame");
var modalTitle = document.getElementById("modalTitle");
document.addEventListener("click", function(e){
  var b = e.target.closest ? e.target.closest("[data-preview]") : null;
  if (!b) return;
  modalTitle.textContent = b.getAttribute("data-title") || "";
  modalFrame.src = b.getAttribute("data-preview");
  modal.classList.add("open");
});
document.getElementById("modalClose").addEventListener("click", function(){ modal.classList.remove("open"); modalFrame.src = "about:blank"; });
modal.addEventListener("click", function(e){ if (e.target === modal) { modal.classList.remove("open"); modalFrame.src = "about:blank"; } });
document.addEventListener("keydown", function(e){ if (e.key === "Escape") { modal.classList.remove("open"); modalFrame.src = "about:blank"; } });
// ハウススタイル切替（管理トークン必須）
var styleNow = document.getElementById("styleNow");
var styleSelect = document.getElementById("styleSelect");
var styleMsg = document.getElementById("styleMsg");
styleSelect.value = styleNow.textContent || "v2";
styleSelect.addEventListener("change", function(){
  var token = "";
  try { token = localStorage.getItem("daf-admin-token") || ""; } catch(e){}
  if (!token) {
    token = window.prompt("規約を変更するには管理トークン（ADMIN_TOKEN）を入力してください");
    if (!token) { styleSelect.value = styleNow.textContent || "v2"; return; }
    try { localStorage.setItem("daf-admin-token", token); } catch(e){}
  }
  styleMsg.textContent = "変更中...";
  fetch("/_style", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": token },
    body: JSON.stringify({ style: styleSelect.value })
  }).then(function(r){
    return r.json().catch(function(){ return {}; }).then(function(d){ return { ok: r.ok, status: r.status, d: d }; });
  }).then(function(res){
    if (res.ok && res.d && res.d.style) {
      styleNow.textContent = res.d.style;
      styleSelect.value = res.d.style;
      styleMsg.textContent = "変更しました（" + res.d.style + "）";
    } else if (res.status === 403) {
      try { localStorage.removeItem("daf-admin-token"); } catch(e){}
      styleMsg.textContent = "管理トークンが無効です。もう一度お試しください。";
      styleSelect.value = styleNow.textContent || "v2";
    } else {
      styleMsg.textContent = "エラー: " + (res.d.error || res.status);
      styleSelect.value = styleNow.textContent || "v2";
    }
  }).catch(function(){ styleMsg.textContent = "通信エラー"; styleSelect.value = styleNow.textContent || "v2"; });
});
</script>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
</body>
</html>`;
}
