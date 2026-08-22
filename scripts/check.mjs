// リポジトリ健全性チェック（CI でも実行）
import { existsSync, readFileSync } from "node:fs";

const errors = [];

for (const file of ["README.md", "package.json", ".gitignore", "AGENTS.md"]) {
  if (!existsSync(file)) errors.push(`${file} が見つかりません`);
}

const gitignore = existsSync(".gitignore") ? readFileSync(".gitignore", "utf8") : "";
for (const needle of [".dev.vars", ".wrangler/", "node_modules/"]) {
  if (!gitignore.includes(needle)) {
    errors.push(`.gitignore に「${needle}」がありません`);
  }
}

if (errors.length > 0) {
  console.error("NG:");
  for (const e of errors) console.error(` - ${e}`);
  process.exit(1);
}

console.log("OK: repository checks passed");
