#!/usr/bin/env node
// generated/ のアプリを D1（メタデータ）と R2（HTML・サムネイル）に投入する
// 使い方:
//   npm run seed:local   # ローカル（wrangler dev --local 用）
//   npm run seed         # リモート（デプロイ後の本番 DB 用）
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GENERATED_DIR = join(ROOT, "generated");
const CONFIG = join(ROOT, "workers", "gallery", "wrangler.toml");
const DB = "daily-app-factory-db";
const BUCKET = "daily-app-factory-apps";
const SEED_SQL = join(ROOT, "tmp", "seed.sql");
const LOCAL = process.argv.includes("--local");

function run(args, silent = false) {
  // Windows では .cmd ラッパーを shell 経由で起動する（引数に空白を含まない前提）
  const r = spawnSync("npx", args, {
    shell: true,
    // ローカル R2 ストアの基準を wrangler dev と同じく設定ファイルの場所に揃える
    cwd: dirname(CONFIG),
    stdio: silent ? "pipe" : "inherit",
    encoding: "utf8",
  });
  if (r.status !== 0) {
    console.error(`FAILED: npx ${args.slice(0, 4).join(" ")} ...`);
    if (r.error) console.error(r.error.message);
    if (r.stderr) console.error(r.stderr);
    process.exit(1);
  }
  return r.stdout || "";
}

function sq(s) {
  return String(s ?? "").replace(/'/g, "''");
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
    const htmlPath = join(dir, "index.html");
    if (!spec || !existsSync(htmlPath)) continue;
    const dateMatch = entry.name.match(/^(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);
    apps.push({
      slug: spec.slug,
      title: spec.title,
      tagline: spec.tagline ?? "",
      description: spec.reason ?? spec.tagline ?? "",
      axis: spec.axis ?? "",
      tags: Array.isArray(spec.tags) ? spec.tags : [],
      date,
      bytes: statSync(htmlPath).size,
      htmlPath,
      thumbPath: join(dir, "thumb.svg"),
    });
  }
  return apps.sort((a, b) => a.date.localeCompare(b.date));
}

function buildSql(apps) {
  const stmts = ["DELETE FROM apps;", "DELETE FROM app_tags;", "DELETE FROM apps_fts;"];
  for (const a of apps) {
    stmts.push(
      `INSERT OR REPLACE INTO apps (slug,title,tagline,description,axis,origin,published_at,bytes,gen_cost_usd,gen_attempts,status) VALUES ('${sq(a.slug)}','${sq(a.title)}','${sq(a.tagline)}','${sq(a.description)}','${sq(a.axis)}','user','${a.date}T04:00:00.000Z',${a.bytes},0.01,1,'live');`
    );
    for (const tag of a.tags) {
      stmts.push(`INSERT OR IGNORE INTO app_tags (slug, tag) VALUES ('${sq(a.slug)}','${sq(tag)}');`);
    }
    stmts.push(
      `INSERT OR REPLACE INTO apps_fts (slug,title,tagline,description,tags) VALUES ('${sq(a.slug)}','${sq(a.title)}','${sq(a.tagline)}','${sq(a.description)}','${sq(a.tags.join(", "))}');`
    );
  }
  return stmts.join("\n");
}

function main() {
  const apps = collectApps();
  if (!apps.length) {
    console.error("generated/ にアプリがありません。先に npm run generate を実行してください。");
    process.exit(1);
  }
  const scope = LOCAL ? "local" : "remote";
  console.log(`seed: ${apps.length} アプリを D1(${scope}) + R2(${scope}) へ投入します`);

  console.log("D1: メタデータ投入");
  mkdirSync(dirname(SEED_SQL), { recursive: true });
  writeFileSync(SEED_SQL, buildSql(apps), "utf8");
  run([
    "wrangler",
    "d1",
    "execute",
    DB,
    ...(LOCAL ? ["--local"] : ["--remote"]),
    "--config",
    CONFIG,
    "--file",
    SEED_SQL,
  ]);

  console.log("R2: HTML とサムネイル投入");
  for (const a of apps) {
    run(
      [
        "wrangler",
        "r2",
        "object",
        "put",
        `${BUCKET}/apps/${a.slug}/index.html`,
        "--file",
        a.htmlPath,
        ...(LOCAL ? ["--local"] : ["--remote"]),
        "--content-type",
        "text/html;charset=utf-8",
      ],
      true
    );
    if (existsSync(a.thumbPath)) {
      run(
        [
          "wrangler",
          "r2",
          "object",
          "put",
          `${BUCKET}/apps/${a.slug}/thumb.svg`,
          "--file",
          a.thumbPath,
          ...(LOCAL ? ["--local"] : ["--remote"]),
          "--content-type",
          "image/svg+xml",
        ],
        true
      );
    }
    console.log(`  - ${a.slug}`);
  }
  console.log("seed: 完了");
}

main();
