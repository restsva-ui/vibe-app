const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const APP_URL = "https://restsva-ui.github.io/vibe-app/";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

async function telegram(method: string, body: unknown) {
  if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN missing");
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok || !data?.ok) {
    const description = typeof data?.description === "string" ? data.description.slice(0, 240) : "unknown error";
    throw new Error(`Telegram API ${method} failed: ${description}`);
  }
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false }, 405);
  try {
    const update = await req.json();
    const msg = update?.message;
    if (!msg?.chat?.id || typeof msg?.text !== "string") return json({ ok: true });

    const m = msg.text.trim().match(/^\/start(?:\s+ref_(v[0-9a-z]+))?$/i);
    if (!m) return json({ ok: true });

    const code = (m[1] ?? "").toLowerCase();
    const webAppUrl = code ? `${APP_URL}?ref=${encodeURIComponent(code)}` : APP_URL;
    const text = code
      ? "Тебе запросили у VYBE 💜\n\nВідкрий VYBE кнопкою нижче. Реферал буде зарахований після створення анкети 18+."
      : "VYBE 💜 — знайомства, флірт, дружба та приватне спілкування для дорослих 18+.";

    await telegram("sendMessage", {
      chat_id: msg.chat.id,
      text,
      reply_markup: {
        inline_keyboard: [[{ text: "Відкрити VYBE ✨", web_app: { url: webAppUrl } }]],
      },
    });
    return json({ ok: true });
  } catch (e) {
    console.error("telegram-bot:", e instanceof Error ? e.message : String(e));
    return json({ ok: false }, 500);
  }
});
