// D1 / R2 アクセス層

export const AXIS_LABELS = {
  laugh: "笑わせる",
  lighten: "心を軽くする",
  productivity: "生産性",
  insight: "気づき",
  decide: "決める",
  wonder: "好奇心",
  duo: "ふたりで",
};

export const AXIS_COLORS = {
  laugh: "#ffb347",
  lighten: "#7fd6a8",
  productivity: "#4da3ff",
  insight: "#c79bff",
  decide: "#ff8c66",
  wonder: "#5be0d6",
  duo: "#ff7fc3",
};

export const PLANNER_LABELS = {
  deepseek: "DeepSeek",
  openai: "OpenAI",
  anthropic: "Claude",
  gemini: "Gemini",
};

export function plannerLabel(pair) {
  if (!pair) return "";
  return String(pair)
    .split("+")
    .map((id) => PLANNER_LABELS[id] || id)
    .join("+");
}

const SORTS = {
  new: "published_at DESC",
  old: "published_at ASC",
  popular: "views DESC, published_at DESC",
  loved: "reactions DESC, published_at DESC",
  rising: "CAST(views AS REAL) / (julianday('now') - julianday(published_at) + 1) DESC",
  random: "RANDOM()",
};

export function sortKeys() {
  return Object.keys(SORTS);
}

function ftsToken(s) {
  return '"' + String(s).replace(/"/g, '""') + '"';
}

export async function listApps(env, opts = {}) {
  const perPage = Math.min(500, Math.max(1, opts.perPage || 12));
  const page = Math.max(1, opts.page || 1);
  const where = ["status = 'live'"];
  const params = [];

  if (opts.axis) {
    const list = String(opts.axis).split(",").filter(Boolean);
    if (list.length) {
      where.push(`axis IN (${list.map(() => "?").join(",")})`);
      params.push(...list);
    }
  }
  if (opts.origin) {
    where.push("origin = ?");
    params.push(opts.origin);
  }
  if (opts.tag) {
    where.push("EXISTS (SELECT 1 FROM app_tags t WHERE t.slug = apps.slug AND t.tag = ?)");
    params.push(opts.tag);
  }
  const q = (opts.q || "").trim();
  if (q.length >= 3) {
    const fts = q.split(/\s+/).map(ftsToken).join(" AND ");
    where.push("apps.slug IN (SELECT slug FROM apps_fts WHERE apps_fts MATCH ?)");
    params.push(fts);
  } else if (q.length > 0) {
    const like = `%${q}%`;
    where.push(
      `(title LIKE ? OR tagline LIKE ? OR description LIKE ? OR EXISTS (SELECT 1 FROM app_tags t2 WHERE t2.slug = apps.slug AND t2.tag LIKE ?))`
    );
    params.push(like, like, like, like);
  }

  const whereSql = where.join(" AND ");
  const orderBy = SORTS[opts.sort] || SORTS.new;
  const totalRow = await env.DB.prepare(`SELECT COUNT(*) AS c FROM apps WHERE ${whereSql}`)
    .bind(...params)
    .first();
  const total = totalRow ? Number(totalRow.c) : 0;
  const rows = await env.DB.prepare(
    `SELECT slug, title, tagline, description, axis, origin, published_at, bytes, views, reactions, planner, adopted_planner, has_minutes
     FROM apps WHERE ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`
  )
    .bind(...params, perPage, (page - 1) * perPage)
    .all();

  const slugs = rows.results.map((r) => r.slug);
  const tagsBySlug = new Map();
  if (slugs.length) {
    const tagRows = await env.DB.prepare(
      `SELECT slug, tag FROM app_tags WHERE slug IN (${slugs.map(() => "?").join(",")}) ORDER BY tag`
    )
      .bind(...slugs)
      .all();
    for (const t of tagRows.results) {
      if (!tagsBySlug.has(t.slug)) tagsBySlug.set(t.slug, []);
      tagsBySlug.get(t.slug).push(t.tag);
    }
  }

  const apps = rows.results.map((r) => ({ ...r, tags: tagsBySlug.get(r.slug) || [] }));
  return { apps, total, page, perPage };
}

export async function getApp(env, slug) {
  const row = await env.DB.prepare(
    `SELECT slug, title, tagline, description, axis, origin, published_at, bytes, views, reactions, planner, adopted_planner, has_minutes
     FROM apps WHERE slug = ? AND status = 'live'`
  )
    .bind(slug)
    .first();
  if (!row) return null;
  const tagRows = await env.DB.prepare(`SELECT tag FROM app_tags WHERE slug = ? ORDER BY tag`).bind(slug).all();
  return { ...row, tags: tagRows.results.map((t) => t.tag) };
}

export async function facets(env) {
  const [axes, tags, origins] = await Promise.all([
    env.DB.prepare(
      `SELECT axis, COUNT(*) AS c FROM apps WHERE status = 'live' GROUP BY axis ORDER BY c DESC, axis`
    ).all(),
    env.DB.prepare(
      `SELECT t.tag, COUNT(*) AS c FROM app_tags t JOIN apps a ON a.slug = t.slug
       WHERE a.status = 'live' GROUP BY t.tag ORDER BY c DESC, t.tag LIMIT 20`
    ).all(),
    env.DB.prepare(`SELECT origin, COUNT(*) AS c FROM apps WHERE status = 'live' GROUP BY origin`).all(),
  ]);
  return {
    axes: axes.results,
    tags: tags.results,
    origins: origins.results,
  };
}
