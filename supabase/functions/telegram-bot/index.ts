const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
const APP_URL = "https://restsva-ui.github.io/vibe-app/";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

async function telegram(method: string, body: unknown) {
  if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN missing");
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok || !data?.ok) {
    const description =
      typeof data?.description === "string" ? data.description.slice(0, 240) : "unknown error";
    throw new Error(`Telegram API ${method} failed: ${description}`);
  }
  return data.result;
}

function dbClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Database configuration missing");

  return async (path: string, options: RequestInit = {}) => {
    const response = await fetch(`${url}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...(options.headers || {}),
      },
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Database error ${response.status}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  };
}

async function rpc(name: string, payload: Record<string, unknown>) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Database configuration missing");

  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) {
    const message = data?.message || data?.details || text || `RPC error ${response.status}`;
    throw new Error(message);
  }
  return data;
}

const isEnglish = (user: any) =>
  String(user?.language_code || "").toLowerCase().startsWith("en");

async function handlePreCheckout(update: any) {
  const q = update?.pre_checkout_query;
  if (!q?.id || !q?.from?.id) return false;

  const db = dbClient();
  let ok = false;
  let errorMessage = isEnglish(q.from)
    ? "This VYBE order is no longer available. Please create a new one."
    : "Це замовлення VYBE більше недоступне. Створи нове.";

  try {
    const payload = String(q.invoice_payload || "");
    const rows = await db(
      `star_orders?invoice_payload=eq.${encodeURIComponent(payload)}&select=id,telegram_id,currency,total_amount,status,expires_at&limit=1`,
    ) ?? [];
    const order = rows?.[0];

    const valid =
      !!order &&
      String(order.telegram_id) === String(q.from.id) &&
      order.status === "pending" &&
      order.currency === "XTR" &&
      q.currency === "XTR" &&
      Number(order.total_amount) === Number(q.total_amount) &&
      new Date(order.expires_at).getTime() >= Date.now();

    if (order?.status === "pending" && new Date(order.expires_at).getTime() < Date.now()) {
      await db(`star_orders?id=eq.${encodeURIComponent(order.id)}&status=eq.pending`, {
        method: "PATCH",
        body: JSON.stringify({ status: "expired" }),
      });
    }

    ok = valid;
    if (!valid) {
      console.warn("stars:precheckout_rejected", {
        telegram_id: q.from.id,
        payload,
        currency: q.currency,
        total_amount: q.total_amount,
      });
    }
  } catch (e) {
    console.error("stars:precheckout_error", e instanceof Error ? e.message : String(e));
  }

  await telegram("answerPreCheckoutQuery", {
    pre_checkout_query_id: q.id,
    ok,
    ...(ok ? {} : { error_message: errorMessage }),
  });
  return true;
}

async function handleSuccessfulPayment(update: any) {
  const msg = update?.message;
  const payment = msg?.successful_payment;
  if (!msg?.from?.id || !payment?.invoice_payload) return false;

  const result = await rpc("apply_star_payment", {
    p_payload: String(payment.invoice_payload),
    p_telegram_id: Number(msg.from.id),
    p_currency: String(payment.currency || ""),
    p_total_amount: Number(payment.total_amount || 0),
    p_charge_id: String(payment.telegram_payment_charge_id || ""),
  });

  console.log("stars:successful_payment", {
    telegram_id: msg.from.id,
    product_key: result?.product_key ?? null,
    order_id: result?.order_id ?? null,
    applied: result?.applied === true,
  });

  if (result?.applied === true && msg?.chat?.id) {
    const text = isEnglish(msg.from)
      ? "Payment received ⭐ Your VYBE purchase is active."
      : "Оплату отримано ⭐ Покупку VYBE зараховано.";
    await telegram("sendMessage", {
      chat_id: msg.chat.id,
      text,
      reply_markup: {
        inline_keyboard: [[{ text: isEnglish(msg.from) ? "Open VYBE ✨" : "Відкрити VYBE ✨", web_app: { url: APP_URL } }]],
      },
    });
  }
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false }, 405);

  if (WEBHOOK_SECRET) {
    const supplied = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
    if (supplied !== WEBHOOK_SECRET) return json({ ok: false }, 401);
  }

  let update: any;
  try {
    update = await req.json();
  } catch {
    return json({ ok: false }, 400);
  }

  try {
    if (update?.pre_checkout_query) {
      await handlePreCheckout(update);
      return json({ ok: true });
    }

    if (update?.message?.successful_payment) {
      await handleSuccessfulPayment(update);
      return json({ ok: true });
    }

    const msg = update?.message;
    if (!msg?.chat?.id || typeof msg?.text !== "string") return json({ ok: true });

    const m = msg.text.trim().match(/^\/start(?:\s+ref_(v[0-9a-z]+))?$/i);
    if (!m) return json({ ok: true });

    const code = (m[1] ?? "").toLowerCase();
    const webAppUrl = code ? `${APP_URL}?ref=${encodeURIComponent(code)}` : APP_URL;
    const english = isEnglish(msg.from);
    const text = code
      ? english
        ? "You were invited to VYBE 💜\n\nOpen VYBE below. The referral counts after you create an 18+ profile."
        : "Тебе запросили у VYBE 💜\n\nВідкрий VYBE кнопкою нижче. Реферал буде зарахований після створення анкети 18+."
      : english
        ? "VYBE 💜 — dating, flirting, friendship and private communication for adults 18+."
        : "VYBE 💜 — знайомства, флірт, дружба та приватне спілкування для дорослих 18+.";

    await telegram("sendMessage", {
      chat_id: msg.chat.id,
      text,
      reply_markup: {
        inline_keyboard: [[{
          text: english ? "Open VYBE ✨" : "Відкрити VYBE ✨",
          web_app: { url: webAppUrl },
        }]],
      },
    });
    return json({ ok: true });
  } catch (e) {
    console.error("telegram-bot:", e instanceof Error ? e.message : String(e));
    return json({ ok: false }, 500);
  }
});
