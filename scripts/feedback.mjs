#!/usr/bin/env node
// アプリごとのフィードバック管理（Phase 0）
//
// 使い方:
//   node scripts/feedback.mjs add <slug> "<意見>" [--status done]
//   node scripts/feedback.mjs list [slug]
//   node scripts/feedback.mjs resolve <slug> <番号>
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const GENERATED_DIR = join(ROOT, "generated");
const INDEX_DIR = join(ROOT, "feedback");
const INDEX_FILE = join(INDEX_DIR, "index.md");

function todayIso() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

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
    const fbPath = join(dir, "feedback.md");
    const fb = existsSync(fbPath) ? readFileSync(fbPath, "utf8") : "";
    const open = (fb.match(/- \[ \]/g) || []).length;
    const done = (fb.match(/- \[x\]/g) || []).length;
    const slug = spec?.slug || entry.name.split("-").slice(3).join("-") || entry.name;
    const title = spec?.title || entry.name;
    const dateMatch = entry.name.match(/^(\d{4}-\d{2}-\d{2})/);
    apps.push({
      dir,
      name: entry.name,
      slug,
      title,
      date: dateMatch ? dateMatch[1] : "?",
      open,
      done,
      fb,
    });
  }
  return apps.sort((a, b) => a.name.localeCompare(b.name));
}

function findApp(slug) {
  const apps = collectApps();
  const exact = apps.find((a) => a.slug === slug);
  if (exact) return exact;
  const partial = apps.filter((a) => a.slug.includes(slug) || slug.includes(a.slug));
  return partial.length === 1 ? partial[0] : null;
}

function feedbackPath(app) {
  return join(app.dir, "feedback.md");
}

function ensureFeedbackFile(app) {
  if (!existsSync(feedbackPath(app))) {
    const header = `# フィードバック: ${app.title}

- slug: ${app.slug}
- 生成日: ${app.date}

ユーザーやレビューからの意見を1行ずつ記録する。対応が終わった項目は \`npm run feedback -- resolve <slug> <番号>\` で [x] にする。

`;
    writeFileSync(feedbackPath(app), header, "utf8");
  }
}

function refreshIndex() {
  const apps = collectApps();
  mkdirSync(INDEX_DIR, { recursive: true });
  const rows = apps
    .map((a) => {
      const link = a.fb ? `[${a.slug}](../generated/${a.name}/feedback.md)` : a.slug;
      return `| ${link} | ${a.title} | ${a.date} | ${a.open} | ${a.done} |`;
    })
    .join("\n");
  const content = `# アプリ別フィードバック一覧

各アプリの \`generated/<日付>-<slug>/feedback.md\` に個別の意見を記録する。
この一覧は \`npm run feedback -- list\` などの実行時に自動更新される。

| アプリ | タイトル | 生成日 | 未対応 | 対応済み |
|---|---|---|---|---|
${rows}
`;
  writeFileSync(INDEX_FILE, content, "utf8");
}

function addFeedback(app, text, status) {
  ensureFeedbackFile(app);
  const mark = status === "done" ? "[x]" : "[ ]";
  const line = `- ${mark} ${todayIso()}: ${text}\n`;
  writeFileSync(feedbackPath(app), readFileSync(feedbackPath(app), "utf8") + line, "utf8");
  refreshIndex();
  console.log(`追加: ${app.slug} / ${todayIso()} / ${text}`);
}

function listFeedback(appFilter) {
  refreshIndex();
  const apps = appFilter ? [appFilter] : collectApps();
  let shown = false;
  for (const app of apps) {
    if (!app.fb) continue;
    const lines = app.fb.split(/\r?\n/).filter((l) => /^- \[[ x]\]/.test(l));
    if (lines.length === 0) continue;
    shown = true;
    console.log(`\n[${app.slug}] ${app.title}（未対応 ${app.open} / 対応済み ${app.done}）`);
    lines.forEach((l, i) => console.log(`  ${i + 1}. ${l.replace(/^- \[[ x]\]\s*/, "")}${l.startsWith("- [x]") ? "  [対応済み]" : ""}`));
  }
  if (!shown) console.log("フィードバックはまだありません。");
}

function resolveFeedback(app, n) {
  ensureFeedbackFile(app);
  const path = feedbackPath(app);
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  let count = 0;
  let changed = false;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(-\s*)\[([ x])\]/);
    if (!m) continue;
    count++;
    if (count === n) {
      lines[i] = `${m[1]}[${m[2] === " " ? "x" : " "}]` + lines[i].slice(m.index + m[0].length);
      changed = true;
      break;
    }
  }
  if (!changed) {
    console.error(`項目 ${n} が見つかりません（このアプリには ${count} 件あります）`);
    process.exit(1);
  }
  writeFileSync(path, lines.join("\n"), "utf8");
  refreshIndex();
  console.log(`更新: ${app.slug} の項目 ${n} を切り替えました`);
}

function usage() {
  console.log(`使い方:
  npm run feedback -- add <slug> "<意見>" [--status done]
  npm run feedback -- list [slug]
  npm run feedback -- resolve <slug> <番号>

  slug は generated/<日付>-<slug>/ の短縮名（例: anger-bonfire-3min）`);
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd) {
    usage();
    return;
  }
  if (cmd === "add") {
    const slug = rest[0];
    const text = rest[1];
    if (!slug || !text) {
      usage();
      process.exit(2);
    }
    const statusIndex = rest.indexOf("--status");
    const status = statusIndex >= 0 ? rest[statusIndex + 1] : "todo";
    const app = findApp(slug);
    if (!app) {
      console.error(`アプリが見つかりません: ${slug}`);
      console.error(`利用可能: ${collectApps().map((a) => a.slug).join(", ") || "(なし)"}`);
      process.exit(1);
    }
    addFeedback(app, text, status);
    return;
  }
  if (cmd === "list") {
    let app = null;
    if (rest[0]) {
      app = findApp(rest[0]);
      if (!app) {
        console.error(`アプリが見つかりません: ${rest[0]}`);
        console.error(`利用可能: ${collectApps().map((a) => a.slug).join(", ") || "(なし)"}`);
        process.exit(1);
      }
    }
    listFeedback(app);
    return;
  }
  if (cmd === "resolve") {
    const slug = rest[0];
    const n = Number(rest[1]);
    if (!slug || !Number.isInteger(n) || n < 1) {
      usage();
      process.exit(2);
    }
    const app = findApp(slug);
    if (!app) {
      console.error(`アプリが見つかりません: ${slug}`);
      process.exit(1);
    }
    resolveFeedback(app, n);
    return;
  }
  usage();
  process.exit(2);
}

main();
