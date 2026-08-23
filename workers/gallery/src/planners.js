// 企画ステージの複数モデル参加（DeepSeek / OpenAI / Anthropic / Gemini）
import { chat } from "./deepseek.js";

// 料金は 2026-08 時点の公開価格（USD / 1M tokens）。変更時はここを更新する
const PLANNERS = [
  {
    id: "deepseek",
    label: "DeepSeek",
    key: (env) => env.DEEPSEEK_API_KEY,
    model: (env) => env.DEEPSEEK_PLAN_MODEL || "deepseek-v4-pro",
    pricing: { in: 0.66, out: 1.98 },
  },
  {
    id: "openai",
    label: "OpenAI",
    key: (env) => env.OPENAI_API_KEY,
    model: (env) => env.OPENAI_PLAN_MODEL || "gpt-5-mini",
    pricing: { in: 0.25, out: 2.0 },
  },
  {
    id: "anthropic",
    label: "Claude",
    key: (env) => env.ANTHROPIC_API_KEY,
    model: (env) => env.ANTHROPIC_PLAN_MODEL || "claude-sonnet-5",
    pricing: { in: 2.0, out: 10.0 },
  },
  {
    id: "gemini",
    label: "Gemini",
    key: (env) => env.GEMINI_API_KEY,
    model: (env) => env.GEMINI_PLAN_MODEL || "gemini-3.7-flash",
    pricing: { in: 0.75, out: 3.75 },
  },
];

export function activePlanners(env) {
  return PLANNERS.filter((p) => p.key(env));
}

async function fetchJson(url, options) {
  let lastError;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, {
        ...options,
        signal: options.signal || AbortSignal.timeout(120000),
      });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 200)}`);
      return await res.json();
    } catch (err) {
      lastError = err;
      if (i < 2) await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
    }
  }
  throw lastError;
}

function estimateCost(provider, usage) {
  if (!usage) return { usd: 0, inTok: 0, cached: 0, outTok: 0 };
  const p = provider.pricing;
  const inTok = usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokenCount ?? 0;
  const cached =
    usage.prompt_tokens_details?.cached_tokens ??
    usage.cache_read_input_tokens ??
    usage.cachedContentTokenCount ??
    0;
  const outTok = usage.completion_tokens ?? usage.output_tokens ?? usage.candidatesTokenCount ?? 0;
  return {
    usd: ((inTok - cached) * p.in + cached * 0 + outTok * p.out) / 1e6,
    inTok,
    cached,
    outTok,
  };
}

export async function planWith(env, provider, { system, user }) {
  const model = provider.model(env);
  const key = provider.key(env);
  let text = "";
  let usage = null;
  if (provider.id === "deepseek") {
    const r = await chat(env, { model, system, user, thinking: true });
    text = r.text;
    usage = r.usage;
  } else if (provider.id === "openai") {
    const data = await fetchJson("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    text = data.choices?.[0]?.message?.content ?? "";
    usage = data.usage;
  } else if (provider.id === "anthropic") {
    const data = await fetchJson("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4000,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    text = (data.content || []).map((c) => c.text || "").join("");
    usage = data.usage;
  } else if (provider.id === "gemini") {
    const data = await fetchJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
        }),
      }
    );
    text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
    usage = data.usageMetadata;
  }
  return { text, usage, cost: estimateCost(provider, usage) };
}

export { estimateCost as estimatePlanCost };
