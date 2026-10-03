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
      `star_orders?invoice_payload=eq.${encodeURIComponent(payload)}&select=id,telegram_id,currency,total_amount,status,expires_at,terms_accepted_at,terms_version&limit=1`,
    ) ?? [];
    const order = rows?.[0];

    const valid =
      !!order &&
      String(order.telegram_id) === String(q.from.id) &&
      order.status === "pending" &&
      order.currency === "XTR" &&
      q.currency === "XTR" &&
      Number(order.total_amount) === Number(q.total_amount) &&
      !!order.terms_accepted_at &&
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

  if (result?.applied === true && result?.product_key === "test_1_star") {
    const db = dbClient();
    try {
      await telegram("refundStarPayment", {
        user_id: Number(msg.from.id),
        telegram_payment_charge_id: String(payment.telegram_payment_charge_id || ""),
      });
      await db(
        `paid_rewards?source_order_id=eq.${encodeURIComponent(String(result.order_id))}`,
        { method: "DELETE" },
      );
      await db(
        `star_orders?id=eq.${encodeURIComponent(String(result.order_id))}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "refunded", refunded_at: new Date().toISOString() }),
        },
      );
      await db("star_products?product_key=eq.test_1_star", {
        method: "PATCH",
        body: JSON.stringify({ active: false, updated_at: new Date().toISOString() }),
      });
      console.log("stars:test_refunded", {
        telegram_id: msg.from.id,
        order_id: result.order_id,
      });
      if (msg?.chat?.id) {
        await telegram("sendMessage", {
          chat_id: msg.chat.id,
          text: isEnglish(msg.from)
            ? "Payment test successful ✅ 1 Star was automatically returned."
            : "Тест оплати успішний ✅ 1 Star автоматично повернуто.",
          reply_markup: {
            inline_keyboard: [[{ text: isEnglish(msg.from) ? "Open VYBE ✨" : "Відкрити VYBE ✨", web_app: { url: APP_URL } }]],
          },
        });
      }
    } catch (e) {
      console.error("stars:test_refund_failed", e instanceof Error ? e.message : String(e));
    }
    return true;
  }

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

async function createSupportTicket(msg: any, category: "general" | "payment", text: string) {
  const db = dbClient();
  const telegramId = Number(msg?.from?.id);
  if (!Number.isFinite(telegramId)) throw new Error("Invalid Telegram user");

  const users = await db(
    `users?telegram_id=eq.${encodeURIComponent(String(telegramId))}&select=id&limit=1`,
  ) ?? [];
  const cleanText = String(text || "").trim().slice(0, 1500);
  if (cleanText.length < 3) return null;

  const rows = await db("support_tickets", {
    method: "POST",
    body: JSON.stringify({
      user_id: users?.[0]?.id ?? null,
      telegram_id: telegramId,
      category,
      message: cleanText,
      status: "open",
    }),
  });
  const ticket = rows?.[0] ?? null;
  if (ticket?.id) {
    try {
      const admins = await db("admin_users?select=user_id&limit=20") ?? [];
      const ids = [...new Set(admins.map((x: any) => String(x.user_id || "")).filter(Boolean))];
      const adminUsers = ids.length
        ? await db(`users?id=in.(${ids.map((x) => encodeURIComponent(x)).join(",")})&select=telegram_id`) ?? []
        : [];
      for (const admin of adminUsers) {
        const chatId = Number(admin.telegram_id);
        if (!Number.isFinite(chatId)) continue;
        try {
          await telegram("sendMessage", {
            chat_id: chatId,
            text: `VYBE Support ⚑\nNew request / Нове звернення: ${category === "payment" ? "payment / оплата" : "general / загальне"}\nID: ${ticket.id}`,
            reply_markup: {
              inline_keyboard: [[{ text: "Open VYBE / Відкрити VYBE", web_app: { url: APP_URL } }]],
            },
          });
        } catch {
          console.warn("support:admin_notify_failed", { ticket_id: ticket.id });
        }
      }
    } catch {
      console.warn("support:admin_notify_setup_failed", { ticket_id: ticket.id });
    }
  }
  return ticket;
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

    const textInput = msg.text.trim();
    const english = isEnglish(msg.from);

    if (/^\/terms$/i.test(textInput)) {
      await telegram("sendMessage", {
        chat_id: msg.chat.id,
        text: english
          ? "VYBE Terms of Use: https://restsva-ui.github.io/vibe-app/terms.html"
          : "Умови користування VYBE: https://restsva-ui.github.io/vibe-app/terms.html",
        disable_web_page_preview: true,
      });
      return json({ ok: true });
    }

    const paymentSupport = textInput.match(/^\/paysupport(?:\s+([\s\S]{3,1500}))?$/i);
    if (paymentSupport) {
      if (!paymentSupport[1]) {
        await telegram("sendMessage", {
          chat_id: msg.chat.id,
          text: english
            ? "For a VYBE payment issue, send: /paysupport <what happened>. Include the approximate time and product, but never send passwords or banking data. Telegram Support cannot resolve purchases made from this bot; VYBE handles payment support."
            : "Для проблеми з оплатою VYBE надішли: /paysupport <що сталося>. Вкажи приблизний час і товар, але не надсилай паролі чи банківські дані. Telegram Support не вирішує покупки в цьому боті — платіжну підтримку опрацьовує VYBE.",
        });
        return json({ ok: true });
      }
      const ticket = await createSupportTicket(msg, "payment", paymentSupport[1]);
      await telegram("sendMessage", {
        chat_id: msg.chat.id,
        text: ticket
          ? (english ? "Payment support request received ✅" : "Запит щодо оплати отримано ✅")
          : (english ? "Please describe the payment issue in more detail." : "Опиши проблему з оплатою трохи детальніше."),
      });
      return json({ ok: true });
    }

    const generalSupport = textInput.match(/^\/support(?:\s+([\s\S]{3,1500}))?$/i);
    if (generalSupport) {
      if (!generalSupport[1]) {
        await telegram("sendMessage", {
          chat_id: msg.chat.id,
          text: english
            ? "For VYBE support, send: /support <your question or problem>."
            : "Для підтримки VYBE надішли: /support <твоє питання або проблема>.",
        });
        return json({ ok: true });
      }
      const ticket = await createSupportTicket(msg, "general", generalSupport[1]);
      await telegram("sendMessage", {
        chat_id: msg.chat.id,
        text: ticket
          ? (english ? "Support request received ✅" : "Запит у підтримку отримано ✅")
          : (english ? "Please describe the issue in more detail." : "Опиши проблему трохи детальніше."),
      });
      return json({ ok: true });
    }

    const m = msg.text.trim().match(/^\/start(?:\s+ref_(v[0-9a-z]+))?$/i);
    if (!m) return json({ ok: true });

    const code = (m[1] ?? "").toLowerCase();
    const webAppUrl = code ? `${APP_URL}?ref=${encodeURIComponent(code)}` : APP_URL;
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
