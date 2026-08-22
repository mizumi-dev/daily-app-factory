// 通知（Discord Webhook 対応。未設定なら何もしない）

export async function sendNotify(env, text) {
  const url = env.NOTIFY_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: `[日刊アプリ工房] ${text}` }),
    });
  } catch {
    // 通知失敗はパイプラインを止めない
  }
}
