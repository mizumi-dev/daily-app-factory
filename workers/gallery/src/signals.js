// 市場調査モード: 公式 API / RSS から欲求シグナルを収集して signals に貯める
import { chat, FLASH } from "./deepseek.js";
import { extractJsonArray } from "./verify.js";

async function fetchJson(url, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.json();
}

async function fetchText(url, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.text();
}

function rssTitles(xml, limit) {
  return [...xml.matchAll(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/g)]
    .map((m) => m[1].trim())
    .filter(Boolean)
    .slice(1, limit + 1);
}

async function collectItems() {
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
      const j = await fetchJson(`https://www.reddit.com/r/${sub}/top.json?t=week&limit=15`, {
        "User-Agent": "daily-app-factory/0.1",
      });
      for (const c of j.data?.children?.slice(0, 12) || []) {
        const d = c.data || {};
        items.push({
          source: "reddit",
          url: `https://www.reddit.com${d.permalink || ""}`,
          excerpt: `${d.title || ""} ${(d.selftext || "").slice(0, 300)}`,
        });
      }
    } catch {}
  }
  try {
    const xml = await fetchText("https://trends.google.co.jp/trends/trending/rss?geo=JP");
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
  return items;
}

export async function collectSignals(env, ctx) {
  const items = await collectItems();
  if (!items.length) return { collected: 0 };
  const system = `あなたは市場調査担当。「〜がない」「〜が見つからない」「〜できたらいいのに」「誰か作って」「毎回〜するのが面倒」のような欲求シグナルをテキスト群から抽出してください。
出力は JSON 配列のみ。各要素: {"source": "hn|reddit|trends|zenn", "url": "...", "excerpt": "根拠テキスト（短く）", "need": "欲求の要約（日本語、1文）", "score": 0.0〜1.0}
該当なしでも、最も「誰かが困っていそう・作りたそう」なものを最大10件は抽出して返すこと。score は確信度。`;
  const user = items
    .map((i) => `[${i.source}] ${i.excerpt.slice(0, 200)} (${i.url})`)
    .join("\n")
    .slice(0, 20000);
  const { text } = await chat(env, { model: FLASH, system, user, thinking: false });
  const signals = extractJsonArray(text).filter((s) => s && s.need);
  const now = new Date().toISOString();
  let inserted = 0;
  for (const s of signals.slice(0, 20)) {
    await env.DB.prepare(
      "INSERT INTO signals (source,url,excerpt,need,score,collected_at) VALUES (?,?,?,?,?,?)"
    )
      .bind(
        String(s.source || "auto").slice(0, 20),
        String(s.url || "").slice(0, 500),
        String(s.excerpt || "").slice(0, 1000),
        String(s.need).slice(0, 500),
        Number(s.score) || 0,
        now
      )
      .run();
    inserted++;
  }
  // 抽出が空だった場合は、生テキストを低スコアのシグナルとしてフォールバック保存する
  // （パイプラインの自動モードが常に材料を持てるようにするため）
  if (inserted === 0 && items.length) {
    for (const item of items.slice(0, 8)) {
      await env.DB.prepare(
        "INSERT INTO signals (source,url,excerpt,need,score,collected_at) VALUES (?,?,?,?,?,?)"
      )
        .bind(
          String(item.source).slice(0, 20),
          String(item.url).slice(0, 500),
          String(item.excerpt).slice(0, 1000),
          String(item.excerpt).slice(0, 200),
          0.3,
          now
        )
        .run();
      inserted++;
    }
  }
  return { collected: inserted, candidates: items.length };
}
