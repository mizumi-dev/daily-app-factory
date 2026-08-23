// 市場調査モード: 公式 API / RSS から欲求シグナルを収集して signals に貯める
import { chat, estimateCost, PRO } from "./deepseek.js";
import { extractJsonArray } from "./verify.js";

// 情報源ごとの信頼度ウェイト（「作って」系を高く、話題系を低くする）
const SOURCE_WEIGHTS = { x: 0.95, reddit: 0.95, ph: 0.9, hn: 0.85, note: 0.85, zenn: 0.6, trends: 0.55 };

async function fetchWithRetry(fn) {
  let lastError;
  for (let i = 0; i < 3; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 1500 * 2 ** i));
    }
  }
  throw lastError;
}

async function fetchJson(url, headers = {}) {
  return fetchWithRetry(async () => {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`${url} ${res.status}`);
    return res.json();
  });
}

async function fetchText(url, headers = {}) {
  return fetchWithRetry(async () => {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`${url} ${res.status}`);
    return res.text();
  });
}

function rssTitles(xml, limit) {
  return [...xml.matchAll(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/g)]
    .map((m) => m[1].trim())
    .filter(Boolean)
    .slice(1, limit + 1);
}

function rssItems(xml, limit) {
  const items = [];
  const itemRe = /<(?:item|entry)>([\s\S]*?)<\/(?:item|entry)>/g;
  let m;
  while ((m = itemRe.exec(xml)) && items.length < limit) {
    const block = m[1];
    const title = block.match(/<title(?:[^>]*)>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() || "";
    const link =
      block.match(/<link(?:[^>]*)href="([^"]*)"/)?.[1] ||
      block.match(/<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/)?.[1] ||
      "";
    if (title) items.push({ title, link });
  }
  return items;
}

async function collectItems(env) {
  const items = [];
  try {
    const j = await fetchJson("https://hn.algolia.com/api/v1/search?tags=show_hn&hitsPerPage=20");
    for (const h of j.hits?.slice(0, 15) || []) {
      items.push({
        source: "hn",
        url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
        excerpt: `${h.title || ""} ${(h.story_text || "").slice(0, 300)}`,
      });
    }
  } catch {}
  for (const sub of ["SomebodyMakeThis", "Lightbulb"]) {
    try {
      const xml = await fetchText(`https://www.reddit.com/r/${sub}/top/.rss?t=week`, {
        "User-Agent": "daily-app-factory/0.1",
      });
      for (const it of rssItems(xml, 12)) {
        items.push({ source: "reddit", url: it.link || `https://www.reddit.com/r/${sub}/top/`, excerpt: it.title });
      }
    } catch {}
  }
  try {
    const xml = await fetchText("https://trends.google.co.jp/trending/rss?geo=JP");
    for (const t of rssTitles(xml, 12)) {
      items.push({ source: "trends", url: "https://trends.google.co.jp/trends/trending?geo=JP", excerpt: t });
    }
  } catch {}
  try {
    const xml = await fetchText("https://zenn.dev/feed");
    for (const t of rssTitles(xml, 10)) {
      items.push({ source: "zenn", url: "https://zenn.dev", excerpt: t });
    }
  } catch {}
  // X（公式 API v2。有償プランのベアラートークンが必要。未設定ならスキップ）
  if (env.X_BEARER_TOKEN) {
    try {
      const q = encodeURIComponent(
        '("誰か作って" OR "作ってほしい" OR "アプリ欲しい" OR "ツール欲しい" OR "あったらいいな" OR "毎回面倒") -is:retweet lang:ja'
      );
      const since = new Date(Date.now() - 7 * 864e5).toISOString();
      const j = await fetchJson(
        `https://api.twitter.com/2/tweets/search/recent?query=${q}&max_results=30&start_time=${since}&tweet.fields=public_metrics`,
        { Authorization: `Bearer ${env.X_BEARER_TOKEN}` }
      );
      for (const t of j.data || []) {
        items.push({ source: "x", url: `https://x.com/i/web/status/${t.id}`, excerpt: t.text || "" });
      }
    } catch {}
  }
  // note.com（ユーザーRSS。NOTE_USERS でカスタマイズ可）
  const noteUsers = (env.NOTE_USERS || "masuidrive,kaigian,shinshinohara,sunafukin,takahashim,yukimasaki")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const u of noteUsers) {
    try {
      const xml = await fetchText(`https://note.com/${u}/rss`);
      for (const t of rssTitles(xml, 5)) {
        items.push({ source: "note", url: `https://note.com/${u}`, excerpt: t });
      }
    } catch {}
  }
  // Product Hunt（公式フィード）
  try {
    const xml = await fetchText("https://www.producthunt.com/feed");
    for (const t of rssTitles(xml, 10)) {
      items.push({ source: "ph", url: "https://www.producthunt.com/", excerpt: t });
    }
  } catch {}
  return items;
}

export async function collectSignals(env, ctx) {
  const items = await collectItems(env);
  if (!items.length) return { collected: 0 };
  const system = `あなたは市場調査担当。「〜がない」「〜が見つからない」「〜できたらいいのに」「誰か作って」「毎回〜するのが面倒」のような欲求シグナルをテキスト群から抽出してください。
抽出時は以下を優先する:
- 単一 HTML ファイルで作れる小さなアプリ・ツール・体験になりうる欲求
- 特定の誰かの声ではなく、複数の投稿に共通しそうなニーズ
- 医療・法律・投資の助言、大規模なサービス基盤が必要なものは除外する
source は与えられたタグ（hn / reddit / trends / zenn / x / note / ph）をそのまま使うこと。
出力は JSON 配列のみ。各要素: {"source": "hn|reddit|trends|zenn", "url": "...", "excerpt": "根拠テキスト（短く）", "need": "欲求の要約（日本語、1文）", "score": 0.0〜1.0}
該当なしでも、最も「誰かが困っていそう・作りたそう」なものを最大10件は抽出して返すこと。score は確信度。`;
  const user = items
    .map((i) => `[${i.source}] ${i.excerpt.slice(0, 200)} (${i.url})`)
    .join("\n")
    .slice(0, 20000);
  const { text, usage } = await chat(env, { model: PRO, system, user, thinking: true });
  const cost = estimateCost(PRO, usage);
  const signals = extractJsonArray(text).filter((s) => s && s.need);
  const now = new Date().toISOString();
  let inserted = 0;
  for (const s of signals.slice(0, 20)) {
    const url = String(s.url || "").slice(0, 500);
    const source = String(s.source || "auto").toLowerCase().slice(0, 20);
    if (url) {
      const exists = await env.DB.prepare("SELECT 1 AS x FROM signals WHERE url = ?").bind(url).first();
      if (exists) continue;
    }
    const score = Math.min(1, (Number(s.score) || 0) * (SOURCE_WEIGHTS[source] ?? 0.7));
    await env.DB.prepare(
      "INSERT INTO signals (source,url,excerpt,need,score,collected_at) VALUES (?,?,?,?,?,?)"
    )
      .bind(
        source,
        url,
        String(s.excerpt || "").slice(0, 1000),
        String(s.need).slice(0, 500),
        score,
        now
      )
      .run();
    inserted++;
  }
  // 抽出が空だった場合は、生テキストを低スコアのシグナルとしてフォールバック保存する
  // （パイプラインの自動モードが常に材料を持てるようにするため）
  if (signals.length === 0 && items.length) {
    for (const item of items.slice(0, 8)) {
      const url = String(item.url || "").slice(0, 500);
      if (url) {
        const exists = await env.DB.prepare("SELECT 1 AS x FROM signals WHERE url = ?").bind(url).first();
        if (exists) continue;
      }
      await env.DB.prepare(
        "INSERT INTO signals (source,url,excerpt,need,score,collected_at) VALUES (?,?,?,?,?,?)"
      )
        .bind(
          String(item.source).slice(0, 20),
          url,
          String(item.excerpt).slice(0, 1000),
          String(item.excerpt).slice(0, 200),
          0.3,
          now
        )
        .run();
      inserted++;
    }
  }
  await env.CACHE.put(
    "signals:last",
    JSON.stringify({ cost: Number(cost.usd.toFixed(6)), collected: inserted, candidates: items.length, at: now }),
    { expirationTtl: 86400 * 30 }
  );
  return { collected: inserted, candidates: items.length, cost: Number(cost.usd.toFixed(6)) };
}

// テスト/検証用
export { collectItems };
