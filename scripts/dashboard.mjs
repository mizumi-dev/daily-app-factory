#!/usr/bin/env node
// 生成アプリの一覧ダッシュボードを dashboard/index.html に生成する
// 使い方: npm run dashboard
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GENERATED_DIR = join(ROOT, "generated");
const OUT_FILE = join(ROOT, "dashboard", "index.html");

const AXIS_LABELS = {
  laugh: "笑わせる",
  lighten: "心を軽くする",
  productivity: "生産性",
  insight: "気づき",
  decide: "決める",
  wonder: "好奇心",
  duo: "ふたりで",
};

const AXIS_COLORS = {
  laugh: "#ffb347",
  lighten: "#7fd6a8",
  productivity: "#4da3ff",
  insight: "#c79bff",
  decide: "#ff8c66",
  wonder: "#5be0d6",
  duo: "#ff7fc3",
};

function readJsonSafe(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function collectApps() {
  if (!existsSync(GENERATED_DIR)) return [];
  const apps = [];
  for (const entry of readdirSync(GENERATED_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(GENERATED_DIR, entry.name);
    const spec = readJsonSafe(join(dir, "spec.json"));
    const htmlPath = join(dir, "index.html");
    if (!spec || !existsSync(htmlPath)) continue;
    const fbPath = join(dir, "feedback.md");
    const fb = existsSync(fbPath) ? readFileSync(fbPath, "utf8") : "";
    const dateMatch = entry.name.match(/^(\d{4}-\d{2}-\d{2})/);
    apps.push({
      slug: spec.slug ?? entry.name,
      title: spec.title ?? entry.name,
      tagline: spec.tagline ?? "",
      axis: spec.axis ?? "",
      tags: Array.isArray(spec.tags) ? spec.tags : [],
      date: dateMatch ? dateMatch[1] : "",
      bytes: statSync(htmlPath).size,
      origin: spec.origin ?? "user",
      planner: spec.planner ?? "",
      adopted: spec.adopted_planner ?? "",
      hasMinutes: false,
      feedbackOpen: (fb.match(/- \[ \]/g) || []).length,
      appPath: `../generated/${entry.name}/index.html`,
      feedbackPath: `../generated/${entry.name}/feedback.md`,
    });
  }
  return apps.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}

const CSS = `:root{--bg:#0f0e17;--bg-soft:#17161f;--panel:rgba(255,255,255,0.045);--text:#e8e4da;--text-soft:#9c9487;--accent:#ff8c42;--border:rgba(255,255,255,0.09);--ok:#7fd6a8}
@media(prefers-color-scheme:light){:root{--bg:#faf6ee;--bg-soft:#f2ecdf;--panel:rgba(0,0,0,0.045);--text:#2f2b26;--text-soft:#7c7466;--border:rgba(0,0,0,0.12)}}
*{box-sizing:border-box;margin:0;padding:0}body{font-family:"Hiragino Sans","Yu Gothic",Meiryo,"Noto Sans JP",sans-serif;background:var(--bg);color:var(--text);min-height:100%;display:flex;flex-direction:column;align-items:center;padding:24px 16px 40px;line-height:1.6}
main{max-width:1080px;width:100%}header{text-align:center;margin-bottom:18px}h1{font-size:clamp(1.4rem,4.6vw,1.8rem);letter-spacing:0.02em}.sub{color:var(--text-soft);font-size:0.9rem;margin-top:4px}
.progress-wrap{margin:14px auto 0;max-width:420px}.progress-bar{height:8px;border-radius:999px;background:var(--panel);overflow:hidden}.progress-fill{height:100%;width:0%;background:linear-gradient(90deg,#ff8c42,#ffb347);border-radius:999px;transition:width .3s ease}.progress-label{font-size:0.8rem;color:var(--text-soft);margin-top:6px}
.controls{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:center;background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:12px 14px;margin-bottom:18px}
.search{flex:1 1 240px;min-width:180px;background:var(--bg-soft);border:1.5px solid var(--border);border-radius:10px;padding:9px 14px;font-size:0.92rem;color:var(--text);outline:none}.search:focus{border-color:var(--accent)}
.chips{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}.chip{border:1px solid var(--border);background:transparent;color:var(--text-soft);border-radius:999px;padding:5px 12px;font-size:0.8rem;cursor:pointer;font-family:inherit;transition:all .18s ease}.chip:hover{border-color:var(--accent);color:var(--text)}.chip.on{background:var(--accent);border-color:var(--accent);color:#1a130a;font-weight:600}
select.sort{background:var(--bg-soft);border:1.5px solid var(--border);border-radius:10px;padding:8px 10px;font-size:0.85rem;color:var(--text);font-family:inherit;outline:none}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.card{background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:8px;transition:transform .15s ease,box-shadow .2s ease}.card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.18)}
.card-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.axis-badge{font-size:0.72rem;font-weight:700;padding:3px 10px;border-radius:999px;color:#111;letter-spacing:0.04em}.card h2{font-size:1.02rem;line-height:1.4}.tagline{color:var(--text-soft);font-size:0.85rem;min-height:2.6em}
.tags{display:flex;flex-wrap:wrap;gap:5px}.tag{font-size:0.72rem;color:var(--text-soft);background:var(--bg-soft);border:1px solid var(--border);border-radius:999px;padding:2px 9px}
.meta{display:flex;flex-wrap:wrap;gap:8px;font-size:0.75rem;color:var(--text-soft);margin-top:auto}.card-actions{display:flex;gap:8px;align-items:center;margin-top:4px}
.btn{flex:1;text-align:center;text-decoration:none;border:1.5px solid var(--border);background:transparent;color:var(--text);border-radius:999px;padding:8px 0;font-size:0.85rem;cursor:pointer;font-family:inherit;transition:all .18s ease}.btn:hover{border-color:var(--accent);color:var(--accent)}
.review{display:flex;align-items:center;gap:6px;font-size:0.82rem;color:var(--text-soft);cursor:pointer;user-select:none}.review input{accent-color:var(--ok);width:16px;height:16px;cursor:pointer}.review.done{color:var(--ok)}
.fb-badge{font-size:0.72rem;background:rgba(255,140,66,0.16);color:#ffb27a;border:1px solid rgba(255,140,66,0.4);border-radius:999px;padding:2px 9px;text-decoration:none}
.empty{text-align:center;color:var(--text-soft);padding:48px 0}footer{margin-top:28px;text-align:center;font-size:0.75rem;color:var(--text-soft);opacity:0.7}
.pager{display:flex;justify-content:center;align-items:center;gap:12px;margin-top:18px}.pager button{border:1px solid var(--border);background:var(--panel);color:var(--text);border-radius:999px;padding:7px 18px;font-size:0.85rem;cursor:pointer;font-family:inherit}.pager button:hover{border-color:var(--accent);color:var(--accent)}.pager-info{font-size:0.8rem;color:var(--text-soft)}
.style-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center;width:100%;border-top:1px solid var(--border);padding-top:10px;margin-top:4px}.style-badge{font-size:0.8rem;color:var(--text-soft)}.style-badge b{color:var(--accent)}.style-select{background:var(--bg-soft);border:1.5px solid var(--border);border-radius:10px;padding:6px 10px;font-size:0.82rem;color:var(--text);font-family:inherit;outline:none}.style-msg{font-size:0.78rem;color:var(--text-soft)}
.modal{position:fixed;inset:0;background:rgba(0,0,0,0.72);display:none;align-items:center;justify-content:center;z-index:50;padding:20px}.modal.open{display:flex}
.modal-box{width:min(880px,100%);height:min(760px,90vh);background:var(--bg);border-radius:16px;overflow:hidden;display:flex;flex-direction:column;border:1px solid var(--border)}
.modal-head{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:var(--bg-soft)}.modal-title{font-size:0.9rem;font-weight:600}.modal-close{border:1px solid var(--border);background:transparent;color:var(--text);border-radius:999px;padding:5px 14px;cursor:pointer;font-family:inherit}
.modal-frame{flex:1;border:0;width:100%;background:#fff}@media(max-width:480px){.grid{grid-template-columns:1fr}.modal{padding:8px}}`;

const BODY = `<main>
  <header>
    <h1>日刊アプリ工房 ダッシュボード</h1>
    <p class="sub">生成アプリ一覧（最終更新: __UPDATED__）</p>
    <div class="progress-wrap">
      <div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>
      <p class="progress-label" id="progressLabel"></p>
    </div>
  </header>
  <section class="controls">
    <input class="search" id="search" type="search" placeholder="タイトル・タグライン・タグで検索" aria-label="検索">
    <div class="chips" id="chips"></div>
    <select class="sort" id="sort" aria-label="並び順">
      <option value="new">新しい順</option>
      <option value="old">古い順</option>
      <option value="size">サイズ順</option>
      <option value="name">名前順</option>
    </select>
    <div class="style-row">
      <span class="style-badge">ハウススタイル: <b id="styleNow">--</b></span>
      <select id="styleSelect" class="style-select" aria-label="ハウススタイル規約の切替">
        <option value="v1">v1（基本）</option>
        <option value="v2">v2（緩め・既定）</option>
        <option value="v3">v3（厳しめ）</option>
      </select>
      <span class="style-msg" id="styleMsg" role="status"></span>
    </div>
  </section>
  <section class="grid" id="grid"></section>
  <nav class="pager" id="pager" aria-label="ページ送り"></nav>
  <footer>日刊アプリ工房 · AI が自動生成したアプリの一覧です</footer>
</main>
<div class="modal" id="modal" role="dialog" aria-modal="true" aria-label="アプリプレビュー">
  <div class="modal-box">
    <div class="modal-head">
      <span class="modal-title" id="modalTitle"></span>
      <button class="modal-close" id="modalClose" type="button">閉じる</button>
    </div>
    <iframe class="modal-frame" id="modalFrame" sandbox="allow-scripts" title="アプリプレビュー"></iframe>
  </div>
</div>`;

const SCRIPT = `<script>
(function(){
  "use strict";
  var APPS = JSON.parse(document.getElementById("apps-data").textContent);
  var AXIS_LABELS = __AXIS_LABELS__;
  var AXIS_COLORS = __AXIS_COLORS__;
  var state = { q: "", axes: [], sort: "new", page: 1 };
  var PAGE_SIZE = 24;
  var REVIEW_KEY = "daf-review-v1";
  var grid = document.getElementById("grid");
  var pager = document.getElementById("pager");
  var modal = document.getElementById("modal");
  var modalFrame = document.getElementById("modalFrame");
  var modalTitle = document.getElementById("modalTitle");
  var review = (function(){ try { return JSON.parse(localStorage.getItem(REVIEW_KEY) || "{}"); } catch(e){ return {}; } })();
  function saveReview(){ try { localStorage.setItem(REVIEW_KEY, JSON.stringify(review)); } catch(e){} }
  function esc(s){ return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }
  function fmtBytes(n){ return n >= 1024 ? (n/1024).toFixed(1) + "KB" : n + "B"; }
  var PLANNER_LABELS = { deepseek: "DeepSeek", openai: "OpenAI", anthropic: "Claude", gemini: "Gemini" };
  function plannerLabel(pair){ return String(pair || "").split("+").map(function(id){ return PLANNER_LABELS[id] || id; }).join("+"); }
  function renderChips(){
    var html = "";
    Object.keys(AXIS_LABELS).forEach(function(a){
      var on = state.axes.indexOf(a) >= 0 ? " on" : "";
      html += '<button class="chip' + on + '" data-axis="' + a + '" type="button">' + AXIS_LABELS[a] + '</button>';
    });
    document.getElementById("chips").innerHTML = html;
    document.querySelectorAll("#chips .chip").forEach(function(c){
      c.addEventListener("click", function(){
        var a = c.getAttribute("data-axis");
        var i = state.axes.indexOf(a);
        if (i >= 0) state.axes.splice(i, 1); else state.axes.push(a);
        state.page = 1;
        renderChips(); render();
      });
    });
  }
  function filtered(){
    var q = state.q.trim().toLowerCase();
    return APPS.filter(function(a){
      if (state.axes.length && state.axes.indexOf(a.axis) < 0) return false;
      if (!q) return true;
      var hay = (a.title + " " + a.tagline + " " + a.tags.join(" ") + " " + a.slug).toLowerCase();
      return hay.indexOf(q) >= 0;
    }).sort(function(x, y){
      if (state.sort === "old") return x.date.localeCompare(y.date) || x.slug.localeCompare(y.slug);
      if (state.sort === "size") return x.bytes - y.bytes;
      if (state.sort === "name") return x.title.localeCompare(y.title, "ja");
      return y.date.localeCompare(x.date) || x.slug.localeCompare(y.slug);
    });
  }
  function cardHtml(a){
    var color = AXIS_COLORS[a.axis] || "#999";
    var done = review[a.slug] ? " done" : "";
    var fb = a.feedbackOpen > 0 ? '<a class="fb-badge" href="' + esc(a.feedbackPath) + '" target="_blank" rel="noopener">意見 ' + a.feedbackOpen + '</a>' : "";
    var minutes = a.hasMinutes ? '<a class="fb-badge" href="' + esc(a.appPath) + '/minutes.md" target="_blank" rel="noopener">議事録</a>' : "";
    var plannerText = a.planner ? "企画: " + plannerLabel(a.planner) + (a.adopted ? "（" + plannerLabel(a.adopted) + "案採用）" : "") : "";
    return '<article class="card">' +
      '<div class="card-top"><span class="axis-badge" style="background:' + color + '">' + esc(AXIS_LABELS[a.axis] || a.axis) + '</span>' + fb + minutes + '</div>' +
      '<h2>' + esc(a.title) + '</h2>' +
      '<p class="tagline">' + esc(a.tagline) + '</p>' +
      '<div class="tags">' + a.tags.map(function(t){ return '<span class="tag">' + esc(t) + '</span>'; }).join("") + '</div>' +
      '<div class="meta">' + (plannerText ? '<span>' + esc(plannerText) + '</span>' : "") + '<span>' + esc(a.date) + '</span><span>' + fmtBytes(a.bytes) + '</span><span>' + (a.origin === "auto" ? "自動" : "ユーザー投稿") + '</span></div>' +
      '<div class="card-actions">' +
        '<button class="btn" data-preview="' + esc(a.appPath) + '" data-title="' + esc(a.title) + '" type="button">プレビュー</button>' +
        '<a class="btn" href="' + esc(a.appPath) + '" target="_blank" rel="noopener">開く</a>' +
        '<label class="review' + done + '"><input type="checkbox" data-review="' + esc(a.slug) + '"' + (done ? " checked" : "") + '>確認済み</label>' +
      '</div></article>';
  }
  function render(){
    var all = filtered();
    var totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    if (state.page > totalPages) state.page = totalPages;
    var list = all.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
    grid.innerHTML = list.map(cardHtml).join("");
    if (!list.length) grid.innerHTML = '<p class="empty">該当するアプリがありません。</p>';
    grid.querySelectorAll("[data-preview]").forEach(function(b){
      b.addEventListener("click", function(){
        modalTitle.textContent = b.getAttribute("data-title");
        modalFrame.src = b.getAttribute("data-preview");
        modal.classList.add("open");
      });
    });
    grid.querySelectorAll("[data-review]").forEach(function(c){
      c.addEventListener("change", function(){
        review[c.getAttribute("data-review")] = c.checked;
        saveReview(); render();
      });
    });
    var doneCount = APPS.filter(function(a){ return review[a.slug]; }).length;
    var pct = APPS.length ? Math.round(doneCount / APPS.length * 100) : 0;
    document.getElementById("progressFill").style.width = pct + "%";
    document.getElementById("progressLabel").textContent = "確認済み: " + doneCount + " / " + APPS.length + "（" + pct + "%）";
    renderPager(all.length, totalPages);
  }
  function renderPager(total, totalPages){
    if (totalPages <= 1) { pager.innerHTML = ""; return; }
    var html = "";
    if (state.page > 1) html += '<button type="button" data-page="' + (state.page - 1) + '">← 前へ</button>';
    html += '<span class="pager-info">' + state.page + " / " + totalPages + "（全 " + total + " 本）</span>";
    if (state.page < totalPages) html += '<button type="button" data-page="' + (state.page + 1) + '">次へ →</button>';
    pager.innerHTML = html;
    pager.querySelectorAll("[data-page]").forEach(function(b){
      b.addEventListener("click", function(){ state.page = Number(b.getAttribute("data-page")); render(); });
    });
  }
  document.getElementById("search").addEventListener("input", function(e){ state.q = e.target.value; state.page = 1; render(); });
  document.getElementById("sort").addEventListener("change", function(e){ state.sort = e.target.value; state.page = 1; render(); });
  var STYLE_API = "https://daily-app-factory.daily-app-factory.workers.dev";
  var styleNow = document.getElementById("styleNow");
  var styleSelect = document.getElementById("styleSelect");
  var styleMsg = document.getElementById("styleMsg");
  function setStyle(s){
    styleNow.textContent = s || "--";
    styleSelect.value = s || "v2";
  }
  fetch(STYLE_API + "/api/config").then(function(r){ return r.json(); }).then(function(c){
    if (c && c.style) setStyle(c.style);
  }).catch(function(){});
  styleSelect.addEventListener("change", function(){
    var token = "";
    try { token = localStorage.getItem("daf-admin-token") || ""; } catch(e){}
    if (!token) {
      token = window.prompt("規約を変更するには管理トークン（ADMIN_TOKEN）を入力してください");
      if (!token) { setStyle(styleNow.textContent || "v2"); return; }
      try { localStorage.setItem("daf-admin-token", token); } catch(e){}
    }
    styleMsg.textContent = "変更中...";
    fetch(STYLE_API + "/_style", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ style: styleSelect.value })
    }).then(function(r){ return r.json(); }).then(function(d){
      if (d && d.style) {
        setStyle(d.style);
        styleMsg.textContent = "変更しました（" + d.style + "）";
      } else {
        styleMsg.textContent = "エラー: " + (d.error || "変更できませんでした");
        setStyle(styleNow.textContent || "v2");
      }
    }).catch(function(){ styleMsg.textContent = "通信エラー"; setStyle(styleNow.textContent || "v2"); });
  });
  document.getElementById("modalClose").addEventListener("click", function(){ modal.classList.remove("open"); modalFrame.src = "about:blank"; });
  modal.addEventListener("click", function(e){ if (e.target === modal) { modal.classList.remove("open"); modalFrame.src = "about:blank"; } });
  document.addEventListener("keydown", function(e){ if (e.key === "Escape") { modal.classList.remove("open"); modalFrame.src = "about:blank"; } });
  renderChips(); render();
  var LIVE_API = "https://daily-app-factory.daily-app-factory.workers.dev/api/apps";
  function toLive(a){
    return {
      slug: a.slug, title: a.title, tagline: a.tagline || "", axis: a.axis || "",
      tags: a.tags || [], date: (a.published_at || "").slice(0, 10), bytes: a.bytes || 0,
      origin: a.origin || "auto", feedbackOpen: 0,
      planner: a.planner || "", adopted: a.adopted_planner || "",
      hasMinutes: !!a.has_minutes,
      appPath: LIVE_API.replace("/api/apps", "/app/") + a.slug,
      feedbackPath: ""
    };
  }
  fetch(LIVE_API + "?per_page=200").then(function(r){ return r.json(); }).then(function(d){
    if (d && Array.isArray(d.apps) && d.apps.length) {
      APPS = d.apps.map(toLive);
      state.page = 1;
      renderChips(); render();
    }
  }).catch(function(){});
})();
</script>`;

function buildHtml(apps) {
  const dataJson = JSON.stringify(apps).replace(/</g, "\\u003c");
  const updatedAt = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>日刊アプリ工房 ダッシュボード</title>
<style>${CSS}</style>
</head>
<body>
${BODY.replace("__UPDATED__", updatedAt)}
<script type="application/json" id="apps-data">${dataJson}</script>
${SCRIPT.replace("__AXIS_LABELS__", JSON.stringify(AXIS_LABELS)).replace("__AXIS_COLORS__", JSON.stringify(AXIS_COLORS))}
</body>
</html>
`;
}

function main() {
  const apps = collectApps();
  mkdirSync(dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, buildHtml(apps), "utf8");
  console.log(`dashboard: ${OUT_FILE}（${apps.length} アプリ）`);
}

main();
