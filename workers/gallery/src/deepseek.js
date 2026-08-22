// DeepSeek API 呼び出し（Chat Completions）

const BASE = "https://api.deepseek.com/chat/completions";
export const PRO = "deepseek-v4-pro";
export const FLASH = "deepseek-v4-flash";

const PRICING = {
  pro: { hit: 0.022, miss: 0.66, out: 1.98 },
  flash: { hit: 0.007, miss: 0.22, out: 0.66 },
};

export async function chat(env, { model, system, user, thinking = true, timeoutMs = 600000 }) {
  let lastError;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(BASE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          ...(thinking ? {} : { thinking: { type: "disabled" } }),
          stream: false,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = await res.json();
      return {
        text: data.choices?.[0]?.message?.content ?? "",
        usage: data.usage || {},
      };
    } catch (err) {
      lastError = err;
      if (i < 2) await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
    }
  }
  throw lastError;
}

export function estimateCost(model, usage) {
  const p = model.includes("pro") ? PRICING.pro : PRICING.flash;
  const inTok = usage.prompt_tokens ?? 0;
  const cached = usage.prompt_cache_hit_tokens ?? 0;
  const outTok = usage.completion_tokens ?? 0;
  return {
    usd: ((inTok - cached) * p.miss + cached * p.hit + outTok * p.out) / 1e6,
    inTok,
    cached,
    outTok,
  };
}
