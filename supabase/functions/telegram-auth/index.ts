const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

async function hmac(key: string | ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    typeof key === "string" ? new TextEncoder().encode(key) : key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
}

async function validateTelegramInitData(initData: string, botToken: string) {
  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");
  if (!receivedHash) throw new Error("Telegram hash missing");
  params.delete("hash");
  const dataCheckString = Array.from(params.entries())
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const secretKey = await hmac("WebAppData", botToken);
  const calculatedHash = hex(await hmac(secretKey, dataCheckString));
  if (!safeEqual(calculatedHash, receivedHash.toLowerCase())) throw new Error("Invalid Telegram signature");
  const authDateRaw = params.get("auth_date");
  if (!authDateRaw) throw new Error("Telegram auth_date missing");
  const authDate = Number(authDateRaw);
  if (!Number.isFinite(authDate)) throw new Error("Invalid Telegram auth_date");
  const now = Math.floor(Date.now() / 1000);
  const age = now - authDate;
  if (age < -60 || age > 86400) throw new Error("Telegram initData expired");
  const userRaw = params.get("user");
  if (!userRaw) throw new Error("Telegram user missing");
  let user;
  try { user = JSON.parse(userRaw); } catch { throw new Error("Invalid Telegram user"); }
  if (!user?.id) throw new Error("Telegram user id missing");
  return { user, authDate };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  try {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) return json({ ok: false, error: "Server configuration error" }, 500);
    let body: { action?: string; initData?: string };
    try { body = await req.json(); } catch { return json({ ok: false, error: "Invalid JSON body" }, 400); }
    const initData = body?.initData;
    if (typeof initData !== "string" || !initData.length) return json({ ok: false, error: "initData is required" }, 400);
    if (initData.length > 20000) return json({ ok: false, error: "initData is too large" }, 413);
    const telegram = await validateTelegramInitData(initData, botToken);
    if ((body.action ?? "me") !== "me") return json({ ok: false, error: "Unknown action" }, 400);
    return json({
      ok: true,
      authenticated: true,
      user: {
        id: telegram.user.id,
        first_name: telegram.user.first_name ?? "",
        last_name: telegram.user.last_name ?? "",
        username: telegram.user.username ?? null,
        language_code: telegram.user.language_code ?? null,
        is_premium: telegram.user.is_premium === true,
      },
      auth_date: telegram.authDate,
    });
  } catch (error) {
    console.error("telegram-auth:", error instanceof Error ? error.message : String(error));
    return json({ ok: false, authenticated: false, error: error instanceof Error ? error.message : "Authentication failed" }, 401);
  }
});
