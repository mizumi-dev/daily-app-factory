#!/usr/bin/env node
// 各生成アプリのサムネイル（SVG）を generated/<日付>-<slug>/thumb.svg に生成する
// 使い方: npm run thumbs
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GENERATED_DIR = join(ROOT, "generated");

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

function wrapTitle(text, max = 14) {
  const chars = [...String(text ?? "")];
  const lines = [];
  while (chars.length && lines.length < 3) {
    lines.push(chars.splice(0, max).join(""));
  }
  return lines;
}

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function svgFor(spec, color) {
  const lines = wrapTitle(spec.title);
  const lineY = 110 - (lines.length - 1) * 34;
  const titleText = lines
    .map(
      (l, i) =>
        `<text x="300" y="${lineY + i * 42}" text-anchor="middle" font-family="Hiragino Sans, Yu Gothic, Meiryo, sans-serif" font-size="32" font-weight="bold" fill="#f2ede2">${esc(l)}</text>`
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="315" viewBox="0 0 600 315">
  <rect width="600" height="315" fill="#0f0e17"/>
  <rect width="600" height="315" fill="${color}" opacity="0.28"/>
  <circle cx="300" cy="180" r="105" fill="${color}" opacity="0.16"/>
  ${titleText}
  <text x="300" y="238" text-anchor="middle" font-family="Hiragino Sans, Yu Gothic, Meiryo, sans-serif" font-size="16" fill="#b8b0a5">${esc((spec.tagline ?? "").slice(0, 24))}</text>
  <text x="300" y="285" text-anchor="middle" font-family="Hiragino Sans, Yu Gothic, Meiryo, sans-serif" font-size="12" fill="#6f675c">日刊アプリ工房</text>
</svg>
`;
}

function main() {
  if (!existsSync(GENERATED_DIR)) {
    console.log("generated/ がありません");
    return;
  }
  let count = 0;
  for (const entry of readdirSync(GENERATED_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(GENERATED_DIR, entry.name);
    const spec = readJsonSafe(join(dir, "spec.json"));
    if (!spec || !existsSync(join(dir, "index.html"))) continue;
    const color = AXIS_COLORS[spec.axis] || "#999999";
    writeFileSync(join(dir, "thumb.svg"), svgFor(spec, color), "utf8");
    count++;
  }
  console.log(`thumbs: ${count} 件生成`);
}

main();
