import assert from "node:assert/strict";

const originalDeno = (globalThis as any).Deno;
const originalFetch = globalThis.fetch;
const calls: Array<{ method: string; payload: any }> = [];
let handler: (req: Request) => Promise<Response>;
let failPhoto = false;
let failMessage = false;

(globalThis as any).Deno = {
  env: { get: (name: string) => ({
    TELEGRAM_BOT_TOKEN: "bot-branding-fixture",
    TELEGRAM_WEBHOOK_SECRET: "fixture-webhook-secret",
  } as Record<string, string>)[name] },
  serve: (callback: typeof handler) => { handler = callback; },
};
globalThis.fetch = async (input: any, init?: RequestInit) => {
  const url = new URL(String(input));
  assert.equal(url.origin, "https://api.telegram.org");
  const method = url.pathname.split("/").pop()!;
  assert.ok(["sendPhoto", "sendMessage"].includes(method));
  const payload = JSON.parse(String(init?.body));
  calls.push({ method, payload });
  const rejected = (method === "sendPhoto" && failPhoto) || (method === "sendMessage" && failMessage);
  return Response.json(rejected
    ? { ok: false, description: "fixture delivery failed" }
    : { ok: true, result: { message_id: calls.length } }, { status: rejected ? 400 : 200 });
};

const request = (text: string, language = "uk", authorized = true) => new Request("https://fixture.invalid/telegram-bot", {
  method: "POST",
  headers: { "Content-Type": "application/json", ...(authorized ? { "x-telegram-bot-api-secret-token": "fixture-webhook-secret" } : {}) },
  body: JSON.stringify({ message: { chat: { id: 42 }, from: { id: 42, language_code: language }, text } }),
});

try {
  await import("../supabase/functions/telegram-bot/index.ts");
  assert.equal((await handler!(request("/start", "uk", false))).status, 401);
  assert.equal(calls.length, 0, "unauthenticated requests must not deliver a welcome");

  assert.equal((await handler!(request("/start"))).status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "sendPhoto");
  assert.equal(calls[0].payload.photo, "https://restsva-ui.github.io/vibe-app/assets/vybe-avatar.jpg?v=20261006-logo1");
  assert.ok(calls[0].payload.caption.includes("знайомства"));
  assert.equal(calls[0].payload.reply_markup.inline_keyboard[0][0].web_app.url, "https://restsva-ui.github.io/vibe-app/");

  calls.length = 0;
  assert.equal((await handler!(request("/start ref_v123", "en"))).status, 200);
  assert.ok(calls[0].payload.caption.includes("invited"));
  assert.equal(calls[0].payload.reply_markup.inline_keyboard[0][0].web_app.url, "https://restsva-ui.github.io/vibe-app/?ref=v123");
  assert.equal(calls[0].payload.reply_markup.inline_keyboard[0][0].text, "Open VYBE ✨");

  calls.length = 0;
  failPhoto = true;
  assert.equal((await handler!(request("/start"))).status, 200);
  assert.deepEqual(calls.map(c => c.method), ["sendPhoto", "sendMessage"]);
  assert.equal(calls[1].payload.text, calls[0].payload.caption);
  assert.deepEqual(calls[1].payload.reply_markup, calls[0].payload.reply_markup);

  calls.length = 0;
  assert.equal((await handler!(request("/terms"))).status, 200);
  assert.deepEqual(calls.map(c => c.method), ["sendMessage"]);
  assert.ok(calls[0].payload.text.includes("terms.html"));

  calls.length = 0;
  failMessage = true;
  assert.equal((await handler!(request("/start"))).status, 500, "failed delivery must remain retryable by Telegram");
  console.log("Bot branding: webhook authorization, Ukrainian welcome, English referral, text fallback, terms and delivery retry passed");
} finally {
  globalThis.fetch = originalFetch;
  (globalThis as any).Deno = originalDeno;
}
