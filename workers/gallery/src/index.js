// 日刊アプリ工房 ギャラリー Worker
import { listApps, getApp, facets, sortKeys } from "./store.js";
import { renderGallery } from "./gallery.js";
import { runPipeline, statusReport } from "./pipeline.js";
import { collectSignals } from "./signals.js";
import { submitBrief, briefPage } from "./briefs.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    try {
      if (pathname === "/api/briefs" && request.method === "POST") {
        return submitBrief(request, env);
      }
      if (pathname.startsWith("/brief/")) {
        return briefPage(request, env, pathname);
      }
      if (request.method === "POST") {
        if (pathname === "/_run") return admin(env, request, async () => {
          const body = await request.json().catch(() => ({}));
          const result = await runPipeline(env, null, { brief: body.brief || "" });
          return json(result);
        });
        if (pathname === "/_collect") return admin(env, request, async () => {
          const result = await collectSignals(env, null);
          return json(result);
        });
        if (pathname === "/_pause") return admin(env, request, async () => {
          await env.CACHE.put("paused", "true");
          return json({ paused: true });
        });
        if (pathname === "/_resume") return admin(env, request, async () => {
          await env.CACHE.put("paused", "false");
          return json({ paused: false });
        });
      }
      if (pathname === "/_status") {
        if (env.ADMIN_TOKEN && request.headers.get("x-admin-token") !== env.ADMIN_TOKEN) {
          return new Response("Forbidden", { status: 403 });
        }
        return json(await statusReport(env));
      }
      if (pathname === "/" || pathname === "/index.html") return galleryPage(request, env, url);
      if (pathname === "/api/apps") return appsJson(request, env, url);
      if (pathname.startsWith("/app/")) return appRoute(env, pathname);
      if (pathname === "/sitemap.xml") return sitemap(request, env, url);
      if (pathname === "/feed.xml") return feed(request, env, url);
      if (pathname === "/robots.txt") return robots(url);
      return notFound();
    } catch (err) {
      return new Response(`Server Error: ${esc(err.message)}`, { status: 500, headers: htmlHeaders() });
    }
  },

  async scheduled(event, env, ctx) {
    if (event.cron === "0 17 * * *") {
      await ctx.waitUntil(collectSignals(env, ctx));
    } else {
      // 19:00 UTC = 翌 04:00 JST
      await ctx.waitUntil(env.PIPELINE_QUEUE.send({ type: "daily" }));
    }
  },

  async queue(batch, env) {
    for (const msg of batch.messages) {
      await runPipeline(env, null, {});
    }
  },
};

async function admin(env, request, handler) {
  if (env.ADMIN_TOKEN && request.headers.get("x-admin-token") !== env.ADMIN_TOKEN) {
    return new Response("Forbidden", { status: 403 });
  }
  return handler();
}

function htmlHeaders() {
  return { "Content-Type": "text/html; charset=utf-8", "X-Content-Type-Options": "nosniff" };
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function notFound() {
  return new Response("<!doctype html><meta charset=utf-8><title>404</title><h1>404 Not Found</h1>", {
    status: 404,
    headers: htmlHeaders(),
  });
}

function parseParams(url) {
  const params = {};
  for (const key of ["q", "axis", "tag", "origin", "sort", "page"]) {
    const v = url.searchParams.get(key);
    if (v !== null && v !== "") params[key] = v;
  }
  if (!sortKeys().includes(params.sort)) delete params.sort;
  return params;
}

async function galleryPage(request, env, url) {
  const params = parseParams(url);
  const perPage = 12;
  const result = await listApps(env, {
    q: params.q,
    axis: params.axis,
    tag: params.tag,
    origin: params.origin,
    sort: params.sort,
    page: Number(params.page) || 1,
    perPage,
  });
  const f = await facets(env);
  const html = renderGallery({
    apps: result.apps,
    total: result.total,
    page: result.page,
    perPage,
    params,
    facets: f,
    siteKey: env.TURNSTILE_SITE_KEY || "1x00000000000000000000AA",
  });
  return new Response(html, { headers: htmlHeaders() });
}

async function appsJson(request, env, url) {
  const params = parseParams(url);
  const result = await listApps(env, {
    q: params.q,
    axis: params.axis,
    tag: params.tag,
    origin: params.origin,
    sort: params.sort,
    page: Number(params.page) || 1,
    perPage: Math.min(48, Number(url.searchParams.get("per_page")) || 12),
  });
  const f = await facets(env);
  return json({ ...result, facets: f });
}

function json(data) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=60" },
  });
}

async function appRoute(env, pathname) {
  const rest = pathname.slice("/app/".length);
  if (rest.endsWith("/thumb.svg")) {
    const slug = decodeURIComponent(rest.slice(0, -"/thumb.svg".length));
    const obj = await env.APPS.get(`apps/${slug}/thumb.svg`);
    if (!obj) return notFound();
    return new Response(obj.body, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  const slug = decodeURIComponent(rest).replace(/\/+$/, "");
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return notFound();
  const app = await getApp(env, slug);
  if (!app) return notFound();
  const obj = await env.APPS.get(`apps/${slug}/index.html`);
  if (!obj) return notFound();
  return new Response(obj.body, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Security-Policy":
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

async function sitemap(request, env, url) {
  const origin = url.origin;
  const result = await listApps(env, { perPage: 500 });
  const urls = [`<url><loc>${origin}/</loc></url>`];
  for (const app of result.apps) {
    urls.push(`<url><loc>${origin}/app/${esc(app.slug)}</loc></url>`);
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}

async function feed(request, env, url) {
  const origin = url.origin;
  const result = await listApps(env, { perPage: 50, sort: "new" });
  const items = result.apps
    .map((a) => {
      const pubDate = new Date(a.published_at).toUTCString();
      return `<item>
  <title>${esc(a.title)}</title>
  <link>${origin}/app/${esc(a.slug)}</link>
  <guid isPermaLink="true">${origin}/app/${esc(a.slug)}</guid>
  <description>${esc(a.tagline)}</description>
  <pubDate>${pubDate}</pubDate>
</item>`;
    })
    .join("");
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>日刊アプリ工房</title>
  <link>${origin}/</link>
  <description>AI が毎日 1 本作る単一 HTML アプリのギャラリー</description>
  <atom:link href="${origin}/feed.xml" rel="self" type="application/rss+xml"/>
  ${items}
</channel>
</rss>`;
  return new Response(body, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}

function robots(url) {
  return new Response(`User-agent: *\nAllow: /\nSitemap: ${url.origin}/sitemap.xml\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
