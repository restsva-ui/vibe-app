const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200, extraHeaders: Record<string,string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, ...extraHeaders, "Content-Type": "application/json; charset=utf-8" },
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
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
}

async function validateTelegramInitData(initData: string, botToken: string) {
  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");
  if (!receivedHash) throw new Error("Telegram hash missing");
  params.delete("hash");
  const dataCheckString = Array.from(params.entries()).map(([k, v]) => `${k}=${v}`).sort().join("\n");
  const secretKey = await hmac("WebAppData", botToken);
  const calculatedHash = hex(await hmac(secretKey, dataCheckString));
  if (!safeEqual(calculatedHash, receivedHash.toLowerCase())) throw new Error("Invalid Telegram signature");

  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate)) throw new Error("Invalid Telegram auth_date");
  const age = Math.floor(Date.now() / 1000) - authDate;
  if (age < -60 || age > 86400) throw new Error("Telegram initData expired");

  const userRaw = params.get("user");
  if (!userRaw) throw new Error("Telegram user missing");
  let user;
  try { user = JSON.parse(userRaw); } catch { throw new Error("Invalid Telegram user"); }
  if (!user?.id) throw new Error("Telegram user id missing");
  return { user, authDate };
}

const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const referralCode = (telegramId: string | number) => "v" + BigInt(String(telegramId)).toString(36);

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
    const error: any = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

type RateLimitPolicy = {
  windowSeconds: number;
  maxHits: number;
};

const ACTION_RATE_LIMITS: Record<string, RateLimitPolicy> = {
  notification_settings_update: { windowSeconds: 60, maxHits: 30 },
  photo_upload: { windowSeconds: 600, maxHits: 8 },
  photo_remove: { windowSeconds: 600, maxHits: 20 },
  save_profile: { windowSeconds: 600, maxHits: 30 },
  referral_claim: { windowSeconds: 3600, maxHits: 10 },
  support_create: { windowSeconds: 3600, maxHits: 6 },
  admin_moderation_update: { windowSeconds: 60, maxHits: 60 },
  admin_moderation_restrict: { windowSeconds: 60, maxHits: 30 },
  admin_support_update: { windowSeconds: 60, maxHits: 60 },
  admin_test_reset_match: { windowSeconds: 3600, maxHits: 10 },
  admin_refund_star_order: { windowSeconds: 3600, maxHits: 20 },
  admin_finance_reconcile: { windowSeconds: 600, maxHits: 6 },
  star_invoice: { windowSeconds: 600, maxHits: 10 },
  star_test_refund: { windowSeconds: 3600, maxHits: 5 },
  star_order_close: { windowSeconds: 600, maxHits: 30 },
  spotlight_use: { windowSeconds: 60, maxHits: 20 },
  account_delete: { windowSeconds: 3600, maxHits: 5 },
  block_user: { windowSeconds: 60, maxHits: 60 },
  unblock_user: { windowSeconds: 60, maxHits: 60 },
  report_user: { windowSeconds: 3600, maxHits: 20 },
  set_intent: { windowSeconds: 600, maxHits: 30 },
  pass: { windowSeconds: 60, maxHits: 180 },
  super_like: { windowSeconds: 60, maxHits: 60 },
  like: { windowSeconds: 60, maxHits: 120 },
  message_send: { windowSeconds: 60, maxHits: 120 },
};

async function enforceActionRateLimit(userId: string, action: string): Promise<Response | null> {
  const policy = ACTION_RATE_LIMITS[action];
  if (!policy) return null;

  try {
    const result = await rpc("vybe_take_rate_limit", {
      p_user_id: userId,
      p_bucket_key: action,
      p_window_seconds: policy.windowSeconds,
      p_max_hits: policy.maxHits,
      p_cost: 1,
    });

    if (result?.allowed !== false) return null;

    const retryAfter = Math.max(1, Number(result?.retry_after_seconds || 1));
    console.warn("rate_limit:blocked", {
      user_id: userId,
      action,
      retry_after_seconds: retryAfter,
    });
    return json(
      {
        ok: false,
        error: "RATE_LIMITED",
        retry_after_seconds: retryAfter,
      },
      429,
      { "Retry-After": String(retryAfter) },
    );
  } catch (e) {
    console.error("rate_limit:failed", {
      user_id: userId,
      action,
      error: String(e instanceof Error ? e.message : e).slice(0, 180),
    });
    return json({ ok: false, error: "Rate limit check unavailable" }, 503);
  }
}

async function telegramApi(botToken: string, method: string, payload: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok || !data?.ok) {
    const description = typeof data?.description === "string" ? data.description.slice(0, 240) : text.slice(0, 240);
    throw new Error(`Telegram API ${method} failed: ${description || response.status}`);
  }
  return data.result;
}


async function ensurePaymentWebhook(botToken: string) {
  const baseUrl = Deno.env.get("SUPABASE_URL");
  if (!baseUrl) throw new Error("SUPABASE_URL missing");
  const secret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
  if (!secret) throw new Error("TELEGRAM_WEBHOOK_SECRET missing");
  const payload: Record<string, unknown> = {
    url: `${baseUrl}/functions/v1/telegram-bot`,
    allowed_updates: ["message", "pre_checkout_query"],
    drop_pending_updates: false,
    secret_token: secret,
  };
  await telegramApi(botToken, "setWebhook", payload);
}

async function requestStarRefund(botToken: string, orderId: string) {
  const claim = await rpc("claim_star_refund", { p_order_id: orderId });
  if (claim?.already_refunded === true) {
    return {
      ok: true,
      refunded: true,
      already_refunded: true,
      order_id: orderId,
      product_key: claim?.product_key ?? null,
      stars: Number(claim?.total_amount || 0),
    };
  }
  if (claim?.already_refunding === true || claim?.claimed !== true) {
    return {
      ok: true,
      refunded: false,
      refunding: true,
      order_id: orderId,
      product_key: claim?.product_key ?? null,
      stars: Number(claim?.total_amount || 0),
    };
  }

  let telegramRefunded = false;
  try {
    await telegramApi(botToken, "refundStarPayment", {
      user_id: Number(claim.telegram_id),
      telegram_payment_charge_id: String(claim.charge_id),
    });
    telegramRefunded = true;

    try {
      const finalized = await rpc("apply_star_refund", {
        p_payload: String(claim.payload),
        p_telegram_id: Number(claim.telegram_id),
        p_currency: String(claim.currency),
        p_total_amount: Number(claim.total_amount),
        p_charge_id: String(claim.charge_id),
      });
      return {
        ok: true,
        refunded: true,
        reconciling: false,
        order_id: orderId,
        finalized,
        product_key: claim.product_key,
        stars: Number(claim.total_amount || 0),
      };
    } catch (e) {
      console.error("stars:refund_finalize_pending", {
        order_id: orderId,
        error: String(e instanceof Error ? e.message : e).slice(0, 180),
      });
      return {
        ok: true,
        refunded: true,
        reconciling: true,
        order_id: orderId,
        product_key: claim.product_key,
        stars: Number(claim.total_amount || 0),
      };
    }
  } catch (e) {
    if (!telegramRefunded) {
      try {
        await rpc("release_star_refund", { p_order_id: orderId });
      } catch (releaseError) {
        console.error("stars:refund_release_failed", {
          order_id: orderId,
          error: String(releaseError instanceof Error ? releaseError.message : releaseError).slice(0, 180),
        });
      }
    }
    throw e;
  }
}

async function ensureUser(db: ReturnType<typeof dbClient>, tgUser: any) {
  const telegramId = String(tgUser.id);
  const rows = await db(`users?telegram_id=eq.${encodeURIComponent(telegramId)}&select=id,telegram_id,realtime_topic,last_seen,account_status,restricted_at,restriction_reason,restricted_by&limit=1`);
  if (rows?.[0]) {
    const row = rows[0];
    const seenAt = row.last_seen ? new Date(row.last_seen).getTime() : 0;
    if (!seenAt || Date.now() - seenAt > 60000) {
      const now = new Date().toISOString();
      await db(`users?id=eq.${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ last_seen: now }),
      });
      row.last_seen = now;
    }
    return row;
  }

  const created = await db("users", {
    method: "POST",
    body: JSON.stringify({
      telegram_id: Number(telegramId),
      username: tgUser.username ?? null,
      first_name: tgUser.first_name ?? null,
      last_seen: new Date().toISOString(),
    }),
  });
  if (!created?.[0]) throw new Error("Could not create user");
  return created[0];
}

async function getProfile(db: ReturnType<typeof dbClient>, userId: string) {
  const rows = await db(`profiles?user_id=eq.${encodeURIComponent(userId)}&select=user_id,name,age,city,gender,looking_for,bio,photo_url,verified&limit=1`);
  return rows?.[0] ?? null;
}

async function getAdminRole(db: ReturnType<typeof dbClient>, userId: string): Promise<"owner" | "admin" | null> {
  const rows = await db(`admin_users?user_id=eq.${encodeURIComponent(userId)}&select=role&limit=1`) ?? [];
  const role = rows?.[0]?.role;
  return role === "owner" || role === "admin" ? role : null;
}

async function notifySupportAdmins(db: ReturnType<typeof dbClient>, botToken: string, ticketId: string, category: string) {
  try {
    const admins = await db("admin_users?select=user_id&limit=20") ?? [];
    const ids = [...new Set(admins.map((x: any) => String(x.user_id || "")).filter(Boolean))];
    if (!ids.length) return;
    const users = await db(`users?id=in.(${ids.map((x) => encodeURIComponent(x)).join(",")})&select=telegram_id`) ?? [];
    const label = category === "payment" ? "payment / оплата" : "general / загальне";
    for (const admin of users) {
      const chatId = Number(admin.telegram_id);
      if (!Number.isFinite(chatId)) continue;
      try {
        await telegramApi(botToken, "sendMessage", {
          chat_id: chatId,
          text: `VYBE Support ⚑\nNew request / Нове звернення: ${label}\nID: ${ticketId}`,
          reply_markup: {
            inline_keyboard: [[{
              text: "Open support / Відкрити підтримку",
              web_app: { url: `https://restsva-ui.github.io/vibe-app/?admin=support&ticket=${encodeURIComponent(ticketId)}` },
            }]],
          },
        });
      } catch (e) {
        console.warn("support:admin_notify_failed", { ticket_id: ticketId });
      }
    }
  } catch (e) {
    console.warn("support:admin_notify_setup_failed", { ticket_id: ticketId });
  }
}

async function notifyModerationAdmins(db: ReturnType<typeof dbClient>, botToken: string, reportId: string, reason: string) {
  try {
    const admins = await db("admin_users?select=user_id&limit=20") ?? [];
    const ids = [...new Set(admins.map((x: any) => String(x.user_id || "")).filter(Boolean))];
    if (!ids.length) return;
    const users = await db(`users?id=in.(${ids.map((x) => encodeURIComponent(x)).join(",")})&select=telegram_id`) ?? [];
    const urgent = reason === "underage" || reason === "illegal_content";
    const labels: Record<string,string> = {
      fake_profile: "fake profile / фейк",
      spam: "spam / спам",
      harassment: "harassment / переслідування",
      underage: "underage / неповнолітній",
      sexual_services: "sexual services / сексуальні послуги",
      illegal_content: "illegal content / незаконний контент",
      other: "other / інше",
    };
    for (const admin of users) {
      const chatId = Number(admin.telegram_id);
      if (!Number.isFinite(chatId)) continue;
      try {
        await telegramApi(botToken, "sendMessage", {
          chat_id: chatId,
          text: `${urgent ? "🚨 " : ""}VYBE Moderation\nNew report / Нова скарга: ${labels[reason] || reason}\nID: ${reportId}`,
          reply_markup: {
            inline_keyboard: [[{
              text: "Open moderation / Відкрити модерацію",
              web_app: { url: `https://restsva-ui.github.io/vibe-app/?admin=moderation&report=${encodeURIComponent(reportId)}` },
            }]],
          },
        });
      } catch {
        console.warn("moderation:admin_notify_failed", { report_id: reportId });
      }
    }
  } catch {
    console.warn("moderation:admin_notify_setup_failed", { report_id: reportId });
  }
}

async function notifyReporterReviewed(
  db: ReturnType<typeof dbClient>,
  botToken: string,
  reporterId: string,
  reportId: string,
) {
  try {
    const rows = await db(`users?id=eq.${encodeURIComponent(reporterId)}&select=telegram_id&limit=1`) ?? [];
    const chatId = Number(rows?.[0]?.telegram_id);
    if (!Number.isFinite(chatId)) return;
    await telegramApi(botToken,"sendMessage",{
      chat_id:chatId,
      text:"VYBE Moderation 🛡\n\nYour report has been reviewed. Thank you for helping keep VYBE safer. / Твою скаргу розглянуто. Дякуємо, що допомагаєш робити VYBE безпечнішим.",
      reply_markup:{
        inline_keyboard:[[{text:"Open VYBE / Відкрити VYBE",web_app:{url:"https://restsva-ui.github.io/vibe-app/"}}]],
      },
    });
    await recordNotificationEvent(db,{
      eventType:"system",
      recipientUserId:reporterId,
      sourceKey:`moderation_reviewed:${reportId}`,
      payload:{kind:"moderation_reviewed",report_id:reportId},
    });
    console.log("moderation:reporter_notified",{report_id:reportId,reporter_id:reporterId});
  } catch {
    try {
      await recordNotificationEvent(db,{
        eventType:"system",
        recipientUserId:reporterId,
        sourceKey:`moderation_reviewed:${reportId}`,
        payload:{kind:"moderation_reviewed",report_id:reportId},
      });
    } catch {}
    console.warn("moderation:reporter_notify_failed",{report_id:reportId,reporter_id:reporterId});
  }
}

async function getNotificationPreferences(db: ReturnType<typeof dbClient>, userId: string) {
  const rows = await db(
    `notification_preferences?user_id=eq.${encodeURIComponent(userId)}&select=user_id,likes_enabled,matches_enabled,messages_enabled,updated_at&limit=1`,
  ) ?? [];
  if (rows?.[0]) return rows[0];

  const created = await db("notification_preferences", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      likes_enabled: true,
      matches_enabled: true,
      messages_enabled: true,
      updated_at: new Date().toISOString(),
    }),
  }) ?? [];

  return created?.[0] ?? {
    user_id: userId,
    likes_enabled: true,
    matches_enabled: true,
    messages_enabled: true,
    updated_at: new Date().toISOString(),
  };
}

async function recordNotificationEvent(
  db: ReturnType<typeof dbClient>,
  input: {
    eventType: "like" | "match" | "message" | "system";
    recipientUserId: string;
    actorUserId?: string | null;
    matchId?: string | null;
    sourceKey?: string | null;
    variant?: "like" | "super";
    payload?: Record<string, unknown>;
  },
) {
  if (input.sourceKey) {
    const existing = await db(
      `notification_events?source_key=eq.${encodeURIComponent(input.sourceKey)}&select=id,recipient_user_id,event_type,match_id,source_key,created_at,seen_at&limit=1`,
    ) ?? [];
    if (existing?.[0]) return { event: existing[0], created: false };
  }

  try {
    const rows = await db("notification_events", {
      method: "POST",
      body: JSON.stringify({
        recipient_user_id: input.recipientUserId,
        actor_user_id: input.actorUserId ?? null,
        event_type: input.eventType,
        match_id: input.matchId ?? null,
        source_key: input.sourceKey ?? null,
        payload: { ...(input.payload ?? {}), ...(input.variant ? { variant: input.variant } : {}) },
      }),
    }) ?? [];
    return { event: rows?.[0] ?? null, created: true };
  } catch (e) {
    if (input.sourceKey) {
      const existing = await db(
        `notification_events?source_key=eq.${encodeURIComponent(input.sourceKey)}&select=id,recipient_user_id,event_type,match_id,source_key,created_at,seen_at&limit=1`,
      ) ?? [];
      if (existing?.[0]) return { event: existing[0], created: false };
    }
    throw e;
  }
}

async function sendSocialNotification(
  db: ReturnType<typeof dbClient>,
  botToken: string,
  input: {
    eventType: "like" | "match" | "message";
    recipientUserId: string;
    actorUserId?: string | null;
    matchId?: string | null;
    sourceKey?: string | null;
    variant?: "like" | "super";
  },
) {
  try {
    if (input.actorUserId && await isBlockedBetween(db, input.actorUserId, input.recipientUserId)) return false;

    const recipientRows = await db(
      `users?id=eq.${encodeURIComponent(input.recipientUserId)}&select=id,telegram_id,last_seen,account_status&limit=1`,
    ) ?? [];
    const recipient = recipientRows?.[0];
    if (!recipient || recipient.account_status === "restricted") return false;

    await recordNotificationEvent(db,input);

    const prefs = await getNotificationPreferences(db, input.recipientUserId);
    if (input.eventType === "like" && prefs.likes_enabled !== true) return false;
    if (input.eventType === "match" && prefs.matches_enabled !== true) return false;
    if (input.eventType === "message" && prefs.messages_enabled !== true) return false;

    const claim = await rpc("vybe_claim_notification_delivery", {
      p_recipient_user_id: input.recipientUserId,
      p_actor_user_id: input.actorUserId ?? null,
      p_event_type: input.eventType,
      p_match_id: input.matchId ?? null,
      p_source_key: input.sourceKey ?? null,
      p_cooldown_seconds: input.eventType === "message" && input.matchId ? 180 : 0,
    });
    if (claim?.claimed !== true || !claim?.delivery_id) return false;
    const deliveryId = String(claim.delivery_id);

    let text = "";
    let buttonText = "Open VYBE / Відкрити VYBE";
    let url = "https://restsva-ui.github.io/vibe-app/";

    if (input.eventType === "like") {
      text = input.variant === "super"
        ? "VYBE ✦\n\nSomeone sent you a SuperVYBE. / Хтось надіслав тобі SuperVYBE."
        : "VYBE 💜\n\nSomeone liked your profile. / Хтось вподобав твою анкету.";
    } else if (input.eventType === "match") {
      text = "VYBE 💜\n\nYou have a mutual VYBE! / У вас взаємний VYBE!";
      buttonText = "Open chat / Відкрити чат";
      if (input.matchId) url = `https://restsva-ui.github.io/vibe-app/?chat=${encodeURIComponent(input.matchId)}`;
    } else {
      text = "VYBE 💬\n\nYou have a new message. / У тебе нове повідомлення.";
      buttonText = "Open chat / Відкрити чат";
      if (input.matchId) url = `https://restsva-ui.github.io/vibe-app/?chat=${encodeURIComponent(input.matchId)}`;
    }

    let sent: any;
    try {
      sent = await telegramApi(botToken, "sendMessage", {
        chat_id: Number(recipient.telegram_id),
        text,
        reply_markup: {
          inline_keyboard: [[{ text: buttonText, web_app: { url } }]],
        },
      });
    } catch (e) {
      try {
        await db(`notification_deliveries?id=eq.${encodeURIComponent(deliveryId)}`, { method: "DELETE" });
      } catch {}
      throw e;
    }

    try {
      await db(
        `notification_deliveries?id=eq.${encodeURIComponent(deliveryId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ telegram_message_id: Number(sent?.message_id || 0) || null }),
        },
      );
    } catch (e) {
      console.warn("social_notification:delivery_finalize_failed", {
        delivery_id: deliveryId,
        event_type: input.eventType,
      });
    }

    console.log("social_notification:sent", {
      event_type: input.eventType,
      recipient_user_id: input.recipientUserId,
      actor_user_id: input.actorUserId ?? null,
      match_id: input.matchId ?? null,
    });
    return true;
  } catch (e) {
    console.warn("social_notification:failed", {
      event_type: input.eventType,
      recipient_user_id: input.recipientUserId,
      match_id: input.matchId ?? null,
    });
    return false;
  }
}

async function isRestrictedUser(db: ReturnType<typeof dbClient>, userId: string): Promise<boolean> {
  const rows = await db(`users?id=eq.${encodeURIComponent(userId)}&select=account_status&limit=1`) ?? [];
  return rows?.[0]?.account_status === "restricted";
}

function summarizeStarOrders(orders: any[]) {
  const now = Date.now();
  const calc = (days: number | null) => {
    const since = days == null ? 0 : now - days * 86400000;
    const paid = orders.filter((o: any) => {
      const t = o.paid_at ? new Date(o.paid_at).getTime() : 0;
      return t >= since && (o.status === "paid" || o.status === "refunded");
    });
    const refunded = orders.filter((o: any) => {
      const t = o.refunded_at ? new Date(o.refunded_at).getTime() : 0;
      return t >= since && o.status === "refunded";
    });
    const gross = paid.reduce((n: number, o: any) => n + Number(o.total_amount || 0), 0);
    const refunds = refunded.reduce((n: number, o: any) => n + Number(o.total_amount || 0), 0);
    return {
      gross_stars: gross,
      refunded_stars: refunds,
      net_stars: gross - refunds,
      paid_orders: paid.length,
      refund_orders: refunded.length,
    };
  };
  return {
    today: calc(1),
    days_7: calc(7),
    days_30: calc(30),
    all_time: calc(null),
  };
}

function safeTelegramStarTransaction(tx: any) {
  const incoming = !!tx?.source;
  const outgoing = !!tx?.receiver;
  const amount = Number(tx?.amount ?? 0);
  const partner = incoming ? tx.source : outgoing ? tx.receiver : null;
  return {
    id: String(tx?.id ?? ""),
    amount,
    signed_amount: outgoing ? -Math.abs(amount) : incoming ? Math.abs(amount) : amount,
    nanostar_amount: Number(tx?.nanostar_amount ?? 0),
    date: Number(tx?.date ?? 0),
    direction: incoming ? "incoming" : outgoing ? "outgoing" : "unknown",
    partner_type: partner?.type ?? null,
    transaction_type: partner?.transaction_type ?? null,
    source_type: tx?.source?.type ?? null,
    receiver_type: tx?.receiver?.type ?? null,
    partner_user_id: partner?.type === "user" ? Number(partner?.user?.id ?? 0) || null : null,
    invoice_payload: partner?.type === "user" && typeof partner?.invoice_payload === "string"
      ? String(partner.invoice_payload).slice(0, 180)
      : null,
  };
}

async function fetchTelegramStarTransactions(botToken: string, maxTransactions = 1000) {
  const limit = 100;
  const max = Math.max(limit, Math.min(1000, Math.floor(maxTransactions || 1000)));
  const all: any[] = [];
  let offset = 0;
  let complete = false;

  while (all.length < max) {
    const page = await telegramApi(botToken, "getStarTransactions", {
      offset,
      limit: Math.min(limit, max - all.length),
    });
    const rows = Array.isArray(page?.transactions) ? page.transactions : [];
    all.push(...rows);
    offset += rows.length;
    if (rows.length < limit) {
      complete = true;
      break;
    }
  }

  return {
    transactions: all.map(safeTelegramStarTransaction),
    complete,
    fetched: all.length,
    max_transactions: max,
  };
}

function buildFinanceReconciliation(
  orders: any[],
  telegramScan: { transactions: any[]; complete: boolean; fetched: number; max_transactions: number },
  paidRewards: any[],
) {
  const txById = new Map<string, any[]>();
  for (const tx of telegramScan.transactions || []) {
    const id = String(tx?.id || "");
    if (!id) continue;
    const list = txById.get(id) ?? [];
    list.push(tx);
    txById.set(id, list);
  }

  const rewardsByOrder = new Map<string, any[]>();
  for (const reward of paidRewards || []) {
    const key = String(reward?.source_order_id || "");
    if (!key) continue;
    const list = rewardsByOrder.get(key) ?? [];
    list.push(reward);
    rewardsByOrder.set(key, list);
  }

  const chargeOrders = (orders || []).filter((o: any) =>
    !!o?.telegram_payment_charge_id &&
    ["paid","refunding","refunded"].includes(String(o?.status || ""))
  );
  const localByCharge = new Map(
    chargeOrders.map((o: any) => [String(o.telegram_payment_charge_id), o]),
  );

  const issues: any[] = [];
  const repairableOrders: any[] = [];
  let matched = 0;

  const addIssue = (order: any, code: string, severity: string, details: Record<string, unknown> = {}, repairable = false) => {
    issues.push({
      code,
      severity,
      repairable,
      order_id: order?.id ?? null,
      product_key: order?.product_key ?? null,
      status: order?.status ?? null,
      stars: Number(order?.total_amount || 0),
      charge_id: order?.telegram_payment_charge_id ?? null,
      ...details,
    });
  };

  for (const order of chargeOrders) {
    const chargeId = String(order.telegram_payment_charge_id);
    const txs = txById.get(chargeId) ?? [];
    const incoming = txs.find((tx: any) => tx.direction === "incoming") ?? null;
    const outgoing = txs.find((tx: any) => tx.direction === "outgoing") ?? null;
    const amount = Number(order.total_amount || 0);
    let orderClean = true;

    if (!incoming) {
      addIssue(
        order,
        telegramScan.complete ? "telegram_incoming_missing" : "telegram_incoming_not_in_scan",
        telegramScan.complete ? "high" : "info",
        { scan_complete: telegramScan.complete },
      );
      orderClean = false;
    } else {
      if (Number(incoming.amount || 0) !== amount) {
        addIssue(order, "amount_mismatch", "critical", {
          telegram_amount: Number(incoming.amount || 0),
          local_amount: amount,
        });
        orderClean = false;
      }
      if (incoming.invoice_payload && String(incoming.invoice_payload) !== String(order.invoice_payload || "")) {
        addIssue(order, "invoice_payload_mismatch", "critical", {
          telegram_payload: incoming.invoice_payload,
          local_payload: order.invoice_payload ?? null,
        });
        orderClean = false;
      }
      if (incoming.partner_user_id && Number(incoming.partner_user_id) !== Number(order.telegram_id)) {
        addIssue(order, "telegram_user_mismatch", "critical", {
          telegram_user_id: Number(incoming.partner_user_id),
          local_telegram_id: Number(order.telegram_id),
        });
        orderClean = false;
      }
    }

    if (order.status === "paid") {
      if (outgoing) {
        const refundAmountMatches = Number(outgoing.amount || 0) === amount;
        const refundUserMatches = !outgoing.partner_user_id || Number(outgoing.partner_user_id) === Number(order.telegram_id);
        const refundPayloadMatches = !outgoing.invoice_payload || String(outgoing.invoice_payload) === String(order.invoice_payload || "");
        const repairable = refundAmountMatches && refundUserMatches && refundPayloadMatches;
        if (repairable) {
          addIssue(order, "telegram_refunded_local_paid", "critical", {}, true);
          repairableOrders.push(order);
        } else {
          addIssue(order, "telegram_refund_mismatch", "critical", {
            telegram_amount: Number(outgoing.amount || 0),
            local_amount: amount,
            telegram_user_id: outgoing.partner_user_id ?? null,
            local_telegram_id: Number(order.telegram_id),
            telegram_payload: outgoing.invoice_payload ?? null,
            local_payload: order.invoice_payload ?? null,
          });
        }
        orderClean = false;
      }
      if (["supervybe","spotlight"].includes(String(order.grant_type || "")) && !(rewardsByOrder.get(String(order.id))?.length)) {
        addIssue(order, "paid_grant_missing", "critical");
        orderClean = false;
      }
    }

    if (order.status === "refunding") {
      const refundMatches = !!outgoing
        && Number(outgoing.amount || 0) === amount
        && (!outgoing.partner_user_id || Number(outgoing.partner_user_id) === Number(order.telegram_id))
        && (!outgoing.invoice_payload || String(outgoing.invoice_payload) === String(order.invoice_payload || ""));
      if (refundMatches) {
        addIssue(order, "telegram_refunded_local_refunding", "high", {}, true);
        repairableOrders.push(order);
      } else if (outgoing) {
        addIssue(order, "telegram_refund_mismatch", "critical", {
          telegram_amount: Number(outgoing.amount || 0),
          local_amount: amount,
          telegram_user_id: outgoing.partner_user_id ?? null,
          local_telegram_id: Number(order.telegram_id),
          telegram_payload: outgoing.invoice_payload ?? null,
          local_payload: order.invoice_payload ?? null,
        });
      } else {
        const requestedAt = order.refund_requested_at ? new Date(order.refund_requested_at).getTime() : 0;
        const stuck = requestedAt > 0 && Date.now() - requestedAt > 10 * 60 * 1000;
        addIssue(order, stuck ? "refund_stuck" : "refund_in_progress", stuck ? "high" : "info", {
          refund_requested_at: order.refund_requested_at ?? null,
        });
      }
      orderClean = false;
    }

    if (order.status === "refunded") {
      if (!outgoing) {
        addIssue(
          order,
          telegramScan.complete ? "telegram_refund_missing" : "telegram_refund_not_in_scan",
          telegramScan.complete ? "high" : "info",
          { scan_complete: telegramScan.complete },
        );
        orderClean = false;
      } else if (Number(outgoing.amount || 0) !== amount) {
        addIssue(order, "refund_amount_mismatch", "critical", {
          telegram_amount: Number(outgoing.amount || 0),
          local_amount: amount,
        });
        orderClean = false;
      }
      if (rewardsByOrder.get(String(order.id))?.length) {
        addIssue(order, "refunded_grant_still_present", "critical");
        orderClean = false;
      }
    }

    if (orderClean) matched += 1;
  }

  for (const tx of telegramScan.transactions || []) {
    if (tx.direction !== "incoming") continue;
    if (tx.partner_type !== "user" || tx.transaction_type !== "invoice_payment") continue;
    if (!String(tx.invoice_payload || "").startsWith("vybe_star:")) continue;
    if (localByCharge.has(String(tx.id))) continue;
    issues.push({
      code: "telegram_payment_without_local_order",
      severity: "critical",
      repairable: false,
      order_id: null,
      product_key: null,
      status: null,
      stars: Number(tx.amount || 0),
      charge_id: String(tx.id || ""),
      invoice_payload: tx.invoice_payload ?? null,
      telegram_user_id: tx.partner_user_id ?? null,
    });
  }

  for (const tx of telegramScan.transactions || []) {
    if (tx.direction !== "outgoing") continue;
    if (tx.partner_type !== "user") continue;
    if (localByCharge.has(String(tx.id))) continue;
    issues.push({
      code: "telegram_refund_without_local_order",
      severity: "critical",
      repairable: false,
      order_id: null,
      product_key: null,
      status: null,
      stars: Number(tx.amount || 0),
      charge_id: String(tx.id || ""),
      telegram_user_id: tx.partner_user_id ?? null,
    });
  }

  const severityRank: Record<string, number> = { critical: 0, high: 1, info: 2 };
  issues.sort((a: any, c: any) =>
    (severityRank[a.severity] ?? 9) - (severityRank[c.severity] ?? 9) ||
    String(a.order_id || a.charge_id || "").localeCompare(String(c.order_id || c.charge_id || ""))
  );

  return {
    scan: {
      telegram_transactions_fetched: Number(telegramScan.fetched || 0),
      telegram_history_complete: telegramScan.complete === true,
      telegram_scan_limit: Number(telegramScan.max_transactions || 0),
      local_charge_orders: chargeOrders.length,
    },
    summary: {
      checked_orders: chargeOrders.length,
      clean_orders: matched,
      issue_count: issues.length,
      critical_count: issues.filter((x: any) => x.severity === "critical").length,
      high_count: issues.filter((x: any) => x.severity === "high").length,
      info_count: issues.filter((x: any) => x.severity === "info").length,
      repairable_count: [...new Set(repairableOrders.map((x: any) => String(x.id)))].length,
    },
    issues,
    repairable_orders: [...new Map(repairableOrders.map((x: any) => [String(x.id), x])).values()],
  };
}

const PROFILE_BUCKET = "profile-photos";
const PROFILE_MAX_BYTES = 2 * 1024 * 1024;

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function detectedImageType(bytes: Uint8Array): "image/webp" | "image/jpeg" | "image/png" | null {
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) return "image/webp";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "image/png";
  return null;
}

const readU32LE = (bytes: Uint8Array, offset: number) =>
  (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;

function profileImageDimensions(bytes: Uint8Array, mime: string): { width: number; height: number } | null {
  if (mime === "image/jpeg") {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
    const sof = new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
    let pos = 2;
    while (pos + 8 < bytes.length) {
      if (bytes[pos] !== 0xff) { pos += 1; continue; }
      while (pos < bytes.length && bytes[pos] === 0xff) pos += 1;
      if (pos >= bytes.length) break;
      const marker = bytes[pos++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (pos + 1 >= bytes.length) return null;
      const len = (bytes[pos] << 8) | bytes[pos + 1];
      if (len < 2 || pos + len > bytes.length) return null;
      if (sof.has(marker) && len >= 7) {
        const height = (bytes[pos + 3] << 8) | bytes[pos + 4];
        const width = (bytes[pos + 5] << 8) | bytes[pos + 6];
        return width > 0 && height > 0 ? { width, height } : null;
      }
      pos += len;
    }
    return null;
  }

  if (mime === "image/webp") {
    if (bytes.length < 30 || String.fromCharCode(...bytes.slice(0,4)) !== "RIFF" || String.fromCharCode(...bytes.slice(8,12)) !== "WEBP") {
      return null;
    }
    if (readU32LE(bytes, 4) + 8 !== bytes.length) return null;
    let pos = 12;
    while (pos + 8 <= bytes.length) {
      const type = String.fromCharCode(...bytes.slice(pos, pos + 4));
      const size = readU32LE(bytes, pos + 4);
      const data = pos + 8;
      if (data + size > bytes.length) return null;

      if (type === "VP8X" && size >= 10) {
        const width = 1 + bytes[data + 4] + (bytes[data + 5] << 8) + (bytes[data + 6] << 16);
        const height = 1 + bytes[data + 7] + (bytes[data + 8] << 8) + (bytes[data + 9] << 16);
        return { width, height };
      }
      if (type === "VP8 " && size >= 10 &&
          bytes[data + 3] === 0x9d && bytes[data + 4] === 0x01 && bytes[data + 5] === 0x2a) {
        const width = ((bytes[data + 7] << 8) | bytes[data + 6]) & 0x3fff;
        const height = ((bytes[data + 9] << 8) | bytes[data + 8]) & 0x3fff;
        return width > 0 && height > 0 ? { width, height } : null;
      }
      if (type === "VP8L" && size >= 5 && bytes[data] === 0x2f) {
        const b1 = bytes[data + 1], b2 = bytes[data + 2], b3 = bytes[data + 3], b4 = bytes[data + 4];
        const width = 1 + (((b2 & 0x3f) << 8) | b1);
        const height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
        return { width, height };
      }
      pos = data + size + (size % 2);
    }
  }

  return null;
}

function hasUnsafeProfileMetadata(bytes: Uint8Array, mime: string): boolean {
  if (mime === "image/jpeg") {
    if (bytes.length < 4 || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) return true;
    let pos = 2;
    while (pos + 3 < bytes.length) {
      if (bytes[pos] !== 0xff) { pos += 1; continue; }
      while (pos < bytes.length && bytes[pos] === 0xff) pos += 1;
      if (pos >= bytes.length) return true;
      const marker = bytes[pos++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (pos + 1 >= bytes.length) return true;
      const len = (bytes[pos] << 8) | bytes[pos + 1];
      if (len < 2 || pos + len > bytes.length) return true;
      if (marker === 0xe1 || marker === 0xed || marker === 0xfe) return true;
      pos += len;
    }
    return false;
  }

  if (mime === "image/webp") {
    if (bytes.length < 20 || readU32LE(bytes, 4) + 8 !== bytes.length) return true;
    let pos = 12;
    while (pos + 8 <= bytes.length) {
      const type = String.fromCharCode(...bytes.slice(pos, pos + 4));
      const size = readU32LE(bytes, pos + 4);
      const data = pos + 8;
      if (data + size > bytes.length) return true;
      if (type === "EXIF" || type === "XMP " || type === "ANIM" || type === "ANMF") return true;
      pos = data + size + (size % 2);
    }
    return pos !== bytes.length;
  }

  return true;
}

const encodeStoragePath = (path: string) =>
  path.split("/").map((part) => encodeURIComponent(part)).join("/");

async function storageRequest(path: string, options: RequestInit = {}) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Storage configuration missing");
  return fetch(`${url}/storage/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(options.headers || {}),
    },
  });
}

const PROFILE_SIGNED_URL_TTL_SECONDS = 7200;
const PROFILE_OBJECT_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:webp|jpg)$/i;

function profilePhotoObjectPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = String(value).trim();
  const markers = [
    `/storage/v1/object/public/${PROFILE_BUCKET}/`,
    `/storage/v1/object/sign/${PROFILE_BUCKET}/`,
    `/storage/v1/object/authenticated/${PROFILE_BUCKET}/`,
  ];

  let path = raw;
  for (const marker of markers) {
    const idx = raw.indexOf(marker);
    if (idx >= 0) {
      path = raw.slice(idx + marker.length).split("?")[0];
      break;
    }
  }

  if (path.includes("://")) return null;
  path = path.split("?")[0];
  try {
    path = path.split("/").map((part) => decodeURIComponent(part)).join("/");
  } catch {
    return null;
  }
  return PROFILE_OBJECT_RE.test(path) ? path : null;
}

async function signProfilePhotoUrls(values: Array<string | null | undefined>) {
  const rawValues = [...new Set(values.map((x) => String(x || "").trim()).filter(Boolean))];
  const pathByRaw = new Map<string,string>();
  for (const raw of rawValues) {
    const path = profilePhotoObjectPath(raw);
    if (path) pathByRaw.set(raw, path);
  }

  const uniquePaths = [...new Set(pathByRaw.values())];
  const signedByPath = new Map<string,string>();
  if (uniquePaths.length) {
    try {
      const response = await storageRequest(
        `object/sign/${PROFILE_BUCKET}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expiresIn: PROFILE_SIGNED_URL_TTL_SECONDS,
            paths: uniquePaths,
          }),
        },
      );
      const text = await response.text();
      if (!response.ok) {
        console.error("profile_photo:sign_failed", {
          status: response.status,
          detail: text.slice(0, 180),
        });
      } else {
        let rows: any[] = [];
        try { rows = JSON.parse(text); } catch {
          console.error("profile_photo:sign_invalid_response");
        }
        const base = Deno.env.get("SUPABASE_URL");
        if (base) {
          for (let i = 0; i < rows.length; i += 1) {
            const row = rows[i] ?? {};
            const path = String(row.path || uniquePaths[i] || "");
            const signedPart = String(row.signedURL || row.signedUrl || "");
            if (!path || !signedPart) continue;
            const signedUrl = /^https?:\/\//i.test(signedPart)
              ? signedPart
              : `${base}/storage/v1${signedPart.startsWith("/") ? signedPart : `/${signedPart}`}`;
            signedByPath.set(path, signedUrl);
          }
        }
      }
    } catch (e) {
      console.error("profile_photo:sign_exception", {
        error: String(e instanceof Error ? e.message : e).slice(0, 180),
      });
    }
  }

  const result = new Map<string,string|null>();
  for (const raw of rawValues) {
    const path = pathByRaw.get(raw);
    const fallbackPublic = raw.includes(`/storage/v1/object/public/${PROFILE_BUCKET}/`) ? raw : null;
    result.set(raw, path ? (signedByPath.get(path) ?? fallbackPublic) : null);
  }
  return result;
}

function withSignedProfilePhoto<T extends Record<string,any>>(row: T | null | undefined, signed: Map<string,string|null>) {
  if (!row) return row ?? null;
  const raw = String(row.photo_url || "").trim();
  return { ...row, photo_url: raw ? (signed.get(raw) ?? null) : null };
}

async function uploadProfilePhoto(userId: string, bytes: Uint8Array, mime: string) {
  const ext = mime === "image/jpeg" ? "jpg" : "webp";
  const objectPath = `${userId}/${crypto.randomUUID()}.${ext}`;
  const response = await storageRequest(
    `object/${PROFILE_BUCKET}/${encodeStoragePath(objectPath)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": mime,
        "Cache-Control": "900",
        "x-upsert": "false",
      },
      body: bytes,
    },
  );
  const text = await response.text();
  if (!response.ok) throw new Error(`Storage upload error ${response.status}: ${text.slice(0, 240)}`);
  return { objectPath };
}

async function deleteProfilePhotoByUrl(photoUrl: string | null | undefined): Promise<boolean> {
  const objectPath = profilePhotoObjectPath(photoUrl);
  if (!objectPath) return !photoUrl;
  const response = await storageRequest(
    `object/${PROFILE_BUCKET}/${encodeStoragePath(objectPath)}`,
    { method: "DELETE" },
  );
  if (!response.ok && response.status !== 404) {
    console.warn("profile_photo:delete_failed", { status: response.status });
    return false;
  }
  return true;
}

async function deleteProfilePhotoWithRetry(photoUrl: string | null | undefined) {
  if (!photoUrl) return true;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    if (await deleteProfilePhotoByUrl(photoUrl)) return true;
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 180 * attempt));
  }
  return false;
}

async function deleteProfilePhotoObjectPath(objectPath: string): Promise<boolean> {
  if (!objectPath) return true;
  const response = await storageRequest(
    `object/${PROFILE_BUCKET}/${encodeStoragePath(objectPath)}`,
    { method: "DELETE" },
  );
  if (!response.ok && response.status !== 404) {
    console.warn("profile_photo:object_delete_failed", { status: response.status });
    return false;
  }
  return true;
}

async function deleteProfilePhotoObjectWithRetry(objectPath: string) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    if (await deleteProfilePhotoObjectPath(objectPath)) return true;
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 180 * attempt));
  }
  return false;
}

async function cleanupProfilePhotoFolder(userId: string, keepObjectPath: string | null = null) {
  let names: string[] = [];
  try {
    const result = await rpc("vybe_profile_photo_objects", { p_user_id: userId });
    names = Array.isArray(result) ? result.map((x: any) => String(x || "")).filter(Boolean) : [];
  } catch (e) {
    console.error("profile_photo:list_failed", {
      user_id: userId,
      error: String(e instanceof Error ? e.message : e).slice(0, 180),
    });
    return false;
  }

  let ok = true;
  const prefix = `${userId}/`;
  for (const name of names) {
    if (name === keepObjectPath) continue;
    if (!name.startsWith(prefix)) {
      ok = false;
      continue;
    }
    if (!await deleteProfilePhotoObjectWithRetry(name)) ok = false;
  }
  return ok;
}

async function getBlockedUserIds(db: ReturnType<typeof dbClient>, userId: string): Promise<Set<string>> {
  const [outgoing, incoming] = await Promise.all([
    db(`blocks?blocker_id=eq.${encodeURIComponent(userId)}&select=blocked_id&limit=1000`),
    db(`blocks?blocked_id=eq.${encodeURIComponent(userId)}&select=blocker_id&limit=1000`),
  ]);
  const ids = new Set<string>();
  for (const row of outgoing ?? []) ids.add(String(row.blocked_id));
  for (const row of incoming ?? []) ids.add(String(row.blocker_id));
  return ids;
}

async function isBlockedBetween(db: ReturnType<typeof dbClient>, userA: string, userB: string): Promise<boolean> {
  const direct = await db(
    `blocks?blocker_id=eq.${encodeURIComponent(userA)}&blocked_id=eq.${encodeURIComponent(userB)}&select=id&limit=1`,
  );
  if (direct?.length) return true;
  const reverse = await db(
    `blocks?blocker_id=eq.${encodeURIComponent(userB)}&blocked_id=eq.${encodeURIComponent(userA)}&select=id&limit=1`,
  );
  return !!reverse?.length;
}

async function ensureBlock(db: ReturnType<typeof dbClient>, blockerId: string, blockedId: string) {
  const existing = await db(
    `blocks?blocker_id=eq.${encodeURIComponent(blockerId)}&blocked_id=eq.${encodeURIComponent(blockedId)}&select=id,created_at&limit=1`,
  );
  if (existing?.[0]) return { created: false, block: existing[0] };

  const rows = await db("blocks", {
    method: "POST",
    body: JSON.stringify({ blocker_id: blockerId, blocked_id: blockedId }),
  });
  return { created: true, block: rows?.[0] ?? null };
}

async function removePairLikes(db: ReturnType<typeof dbClient>, userA: string, userB: string) {
  await db(
    `likes?from_user_id=eq.${encodeURIComponent(userA)}&to_user_id=eq.${encodeURIComponent(userB)}`,
    { method: "DELETE" },
  );
  await db(
    `likes?from_user_id=eq.${encodeURIComponent(userB)}&to_user_id=eq.${encodeURIComponent(userA)}`,
    { method: "DELETE" },
  );
}

async function getMatchOtherUser(
  db: ReturnType<typeof dbClient>,
  matchId: string,
  userId: string,
): Promise<{ id: string; match: any } | null> {
  const rows = await db(
    `matches?id=eq.${encodeURIComponent(matchId)}&or=(user_a_id.eq.${encodeURIComponent(userId)},user_b_id.eq.${encodeURIComponent(userId)})&select=id,user_a_id,user_b_id&limit=1`,
  );
  const match = rows?.[0];
  if (!match) return null;
  const otherId = String(match.user_a_id) === String(userId)
    ? String(match.user_b_id)
    : String(match.user_a_id);
  return { id: otherId, match };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  try {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) return json({ ok: false, error: "Server configuration error" }, 500);

    let body: any;
    try { body = await req.json(); } catch { return json({ ok: false, error: "Invalid JSON body" }, 400); }
    if (typeof body?.initData !== "string" || !body.initData.length) return json({ ok: false, error: "initData is required" }, 400);
    if (body.initData.length > 20000) return json({ ok: false, error: "initData is too large" }, 413);

    const telegram = await validateTelegramInitData(body.initData, botToken);
    const action = body.action ?? "me";

    if (action === "me") {
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
    }

    const db = dbClient();
    const user = await ensureUser(db, telegram.user);

    const restrictedAllowed = new Set([
      "profile_get",
      "support_counts",
      "support_create",
      "support_my",
      "support_mark_seen",
      "account_delete",
      "blocks_list",
      "unblock_user",
      "notification_settings_get",
      "notification_settings_update",
      "notifications_list",
      "notifications_count",
      "notifications_mark_seen",
    ]);
    if (user.account_status === "restricted" && !restrictedAllowed.has(String(action))) {
      return json({
        ok: false,
        error: "ACCOUNT_RESTRICTED",
        account_status: "restricted",
        restriction_reason: user.restriction_reason ?? null,
        restricted_at: user.restricted_at ?? null,
      }, 403);
    }

    const rateLimitResponse = await enforceActionRateLimit(String(user.id), String(action));
    if (rateLimitResponse) return rateLimitResponse;

    if (action === "notification_settings_get") {
      const prefs = await getNotificationPreferences(db, user.id);
      return json({
        ok: true,
        preferences: {
          likes: prefs.likes_enabled === true,
          matches: prefs.matches_enabled === true,
          messages: prefs.messages_enabled === true,
        },
      });
    }

    if (action === "notification_settings_update") {
      const current = await getNotificationPreferences(db, user.id);
      const preferences = {
        likes_enabled: typeof body.likes === "boolean" ? body.likes : current.likes_enabled === true,
        matches_enabled: typeof body.matches === "boolean" ? body.matches : current.matches_enabled === true,
        messages_enabled: typeof body.messages === "boolean" ? body.messages : current.messages_enabled === true,
        updated_at: new Date().toISOString(),
      };
      await db(
        `notification_preferences?user_id=eq.${encodeURIComponent(user.id)}`,
        { method: "PATCH", body: JSON.stringify(preferences) },
      );
      return json({
        ok: true,
        preferences: {
          likes: preferences.likes_enabled,
          matches: preferences.matches_enabled,
          messages: preferences.messages_enabled,
        },
      });
    }

    if (action === "notifications_count") {
      const unread = await rpc("vybe_notification_unread_count", { p_user_id: user.id });
      return json({ ok: true, unread: Number(unread || 0) });
    }

    if (action === "notifications_list") {
      const rows = await rpc("vybe_notifications_for_user", {
        p_user_id: user.id,
        p_limit: 100,
      }) ?? [];

      const notificationPhotoUrls = await signProfilePhotoUrls(
        (rows ?? []).map((x: any) => x?.actor?.photo_url ?? null),
      );
      const notifications = (rows ?? []).map((x: any) => ({
        id: x.id,
        event_type: x.event_type,
        match_id: x.match_id ?? null,
        payload: x.payload ?? {},
        created_at: x.created_at,
        seen_at: x.seen_at ?? null,
        unread: !x.seen_at,
        actor: x.actor
          ? {
              user_id: x.actor.user_id,
              name: x.actor.name || "VYBE",
              photo_url: x.actor.photo_url
                ? (notificationPhotoUrls.get(String(x.actor.photo_url)) ?? null)
                : null,
              verified: x.actor.verified === true,
            }
          : null,
      }));

      return json({
        ok: true,
        unread: notifications.filter((x: any) => x.unread).length,
        notifications,
      });
    }

    if (action === "notifications_mark_seen") {
      const matchIdRaw = clean(body.match_id, 80);
      const matchId = matchIdRaw || null;
      if (matchId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(matchId)) {
        return json({ ok: false, error: "Invalid match id" }, 400);
      }
      const result = await rpc("vybe_mark_notifications_seen", {
        p_user_id: user.id,
        p_match_id: matchId,
      }) ?? {};
      return json({
        ok: true,
        marked: Number(result.marked || 0),
        seen_at: result.seen_at ?? new Date().toISOString(),
        match_id: matchId,
      });
    }

    if (action === "profile_get") {
      const adminRole = await getAdminRole(db, user.id);
      const rawProfile = await getProfile(db, user.id);
      const signedPhotos = await signProfilePhotoUrls([rawProfile?.photo_url]);
      return json({
        ok: true,
        user_id: user.id,
        realtime_topic: user.realtime_topic ?? null,
        admin_role: adminRole,
        account_status: user.account_status ?? "active",
        restriction_reason: user.restriction_reason ?? null,
        restricted_at: user.restricted_at ?? null,
        profile: withSignedProfilePhoto(rawProfile, signedPhotos),
      });
    }

    if (action === "photo_upload") {
      const profile = await getProfile(db, user.id);
      if (!profile) return json({ ok: false, error: "Create profile first" }, 409);

      const declaredMime = clean(body.mime_type, 40).toLowerCase();
      const base64 = typeof body.image_base64 === "string" ? body.image_base64.trim() : "";
      if (!base64 || base64.length > Math.ceil(PROFILE_MAX_BYTES * 4 / 3) + 32) {
        return json({ ok: false, error: "Image is too large" }, 413);
      }

      let bytes: Uint8Array;
      try { bytes = base64ToBytes(base64); } catch { return json({ ok: false, error: "Invalid image encoding" }, 400); }
      if (!bytes.length || bytes.length > PROFILE_MAX_BYTES) return json({ ok: false, error: "Image is too large" }, 413);

      const detected = detectedImageType(bytes);
      if (!detected || detected !== declaredMime || !["image/webp","image/jpeg"].includes(detected)) {
        return json({ ok: false, error: "Unsupported image" }, 400);
      }

      const dimensions = profileImageDimensions(bytes, detected);
      if (!dimensions || dimensions.width !== 900 || dimensions.height !== 900) {
        return json({ ok: false, error: "Profile image must be normalized to 900x900" }, 400);
      }
      if (hasUnsafeProfileMetadata(bytes, detected)) {
        return json({ ok: false, error: "Image metadata is not allowed" }, 400);
      }

      const uploaded = await uploadProfilePhoto(user.id, bytes, detected);
      try {
        await db(`profiles?user_id=eq.${encodeURIComponent(user.id)}`, {
          method: "PATCH",
          body: JSON.stringify({ photo_url: uploaded.objectPath, updated_at: new Date().toISOString() }),
        });
      } catch (e) {
        await deleteProfilePhotoObjectWithRetry(uploaded.objectPath);
        throw e;
      }

      const cleanupOk = await cleanupProfilePhotoFolder(user.id, uploaded.objectPath);
      if (!cleanupOk) {
        console.warn("profile_photo:cleanup_pending", { user_id: user.id });
      }
      const signed = await signProfilePhotoUrls([uploaded.objectPath]);

      return json({
        ok: true,
        photo_url: signed.get(uploaded.objectPath) ?? null,
        cleanup_ok: cleanupOk,
      });
    }

    if (action === "photo_remove") {
      const profile = await getProfile(db, user.id);
      if (!profile) return json({ ok: false, error: "Profile not found" }, 404);
      await db(`profiles?user_id=eq.${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ photo_url: null, updated_at: new Date().toISOString() }),
      });
      const cleanupOk = await cleanupProfilePhotoFolder(user.id, null);
      return json({ ok: true, photo_url: null, cleanup_ok: cleanupOk });
    }

    if (action === "save_profile") {
      const p = body.profile ?? {};
      const name = clean(p.name, 30);
      const age = Number(p.age);
      if (!name || !Number.isInteger(age) || age < 18 || age > 99) return json({ ok: false, error: "Invalid profile" }, 400);

      const payload = {
        user_id: user.id,
        name,
        age,
        city: clean(p.city, 40) || null,
        gender: clean(p.gender, 30) || null,
        looking_for: clean(p.looking, 50) || null,
        bio: clean(p.bio, 180) || null,
      };
      const existing = await getProfile(db, user.id);
      const rows = existing
        ? await db(`profiles?user_id=eq.${encodeURIComponent(user.id)}`, { method: "PATCH", body: JSON.stringify(payload) })
        : await db("profiles", { method: "POST", body: JSON.stringify(payload) });
      const referral = await db(`referrals?referred_id=eq.${encodeURIComponent(user.id)}&activated_at=is.null&select=id&limit=1`);
      if (referral?.length) {
        await db(`referrals?id=eq.${encodeURIComponent(referral[0].id)}`, { method: "PATCH", body: JSON.stringify({ activated_at: new Date().toISOString() }) });
      }
      return json({ ok: true, user_id: user.id, profile: rows?.[0] ?? payload });
    }

    if (action === "referral_claim") {
      const code = clean(body.code, 64).toLowerCase();
      console.log("referral_claim:start", { user_id: user.id, code });
      const ownCode = referralCode(user.telegram_id);
      if (!/^v[0-9a-z]+$/.test(code) || code === ownCode) {
        console.warn("referral_claim:invalid_code", { user_id: user.id, code, is_own: code === ownCode });
        return json({ ok: false, error: "Invalid referral code" }, 400);
      }
      const existing = await db(`referrals?referred_id=eq.${encodeURIComponent(user.id)}&select=id&limit=1`);
      if (existing?.length) {
        console.log("referral_claim:already_claimed", { user_id: user.id });
        return json({ ok: true, claimed: false, reason: "already_claimed" });
      }
      let refTelegramId: string;
      try {
        let n = 0n;
        for (const ch of code.slice(1)) {
          const digit = BigInt(parseInt(ch, 36));
          n = n * 36n + digit;
        }
        refTelegramId = n.toString();
      } catch {
        console.warn("referral_claim:decode_failed", { user_id: user.id, code });
        return json({ ok: false, error: "Invalid referral code" }, 400);
      }
      console.log("referral_claim:decoded", { user_id: user.id, referrer_telegram_id: refTelegramId });
      const refs = await db(`users?telegram_id=eq.${encodeURIComponent(refTelegramId)}&select=id,telegram_id&limit=1`);
      const referrer = refs?.[0];
      if (!referrer || String(referrer.id) === String(user.id)) {
        console.warn("referral_claim:referrer_not_found", { user_id: user.id, referrer_telegram_id: refTelegramId });
        return json({ ok: false, error: "Referrer not found" }, 404);
      }
      await db("referrals", { method: "POST", body: JSON.stringify({ referrer_id: referrer.id, referred_id: user.id, referral_code: code }) });
      console.log("referral_claim:inserted", { user_id: user.id, referrer_id: referrer.id });
      const p = await getProfile(db, user.id);
      if (p) {
        await db(`referrals?referred_id=eq.${encodeURIComponent(user.id)}`, { method: "PATCH", body: JSON.stringify({ activated_at: new Date().toISOString() }) });
        console.log("referral_claim:activated", { user_id: user.id });
      }
      return json({ ok: true, claimed: true });
    }

    if (action === "referral_stats") {
      const rows = await db(`referrals?referrer_id=eq.${encodeURIComponent(user.id)}&select=id,activated_at,created_at&order=created_at.desc&limit=500`) ?? [];
      const activated = rows.filter((x: any) => !!x.activated_at).length;
      const milestones = [
        { milestone: 1, reward_type: "supervybe", reward_amount: 1, label: "1 SuperVYBE" },
        { milestone: 3, reward_type: "spotlight", reward_amount: 1, label: "1 Spotlight" },
        { milestone: 5, reward_type: "vybe_plus", reward_amount: 3, label: "VYBE+ на 3 дні" },
      ];
      let granted = await db(`referral_rewards?user_id=eq.${encodeURIComponent(user.id)}&select=milestone,reward_type,reward_amount,granted_at&order=milestone.asc`) ?? [];
      const grantedSet = new Set(granted.map((x: any) => Number(x.milestone)));
      for (const reward of milestones) {
        if (activated >= reward.milestone && !grantedSet.has(reward.milestone)) {
          try {
            await db("referral_rewards", { method: "POST", body: JSON.stringify({
              user_id: user.id,
              milestone: reward.milestone,
              reward_type: reward.reward_type,
              reward_amount: reward.reward_amount,
            }) });
            grantedSet.add(reward.milestone);
          } catch (e) {
            console.warn("referral_reward:grant_failed", { user_id: user.id, milestone: reward.milestone });
          }
        }
      }
      granted = await db(`referral_rewards?user_id=eq.${encodeURIComponent(user.id)}&select=milestone,reward_type,reward_amount,granted_at&order=milestone.asc`) ?? [];

      // Materialize newly-earned VYBE+ days into the entitlement exactly once.
      const plusReward = granted.find((g: any) => g.reward_type === "vybe_plus");
      if (plusReward) {
        const existingPlus = await db(`user_entitlements?user_id=eq.${encodeURIComponent(user.id)}&select=id,vybe_plus_until,referral_plus_milestone&limit=1`) ?? [];
        const appliedMilestone = Number(existingPlus?.[0]?.referral_plus_milestone || 0);
        const rewardMilestone = Number(plusReward.milestone || 0);
        if (rewardMilestone > appliedMilestone) {
          const base = Math.max(Date.now(), existingPlus?.[0]?.vybe_plus_until ? new Date(existingPlus[0].vybe_plus_until).getTime() : 0);
          const until = new Date(base + Number(plusReward.reward_amount || 0) * 86400000).toISOString();
          const payload = { vybe_plus_until: until, referral_plus_milestone: rewardMilestone, updated_at: new Date().toISOString() };
          if (existingPlus?.length) await db(`user_entitlements?id=eq.${encodeURIComponent(existingPlus[0].id)}`, { method: "PATCH", body: JSON.stringify(payload) });
          else await db("user_entitlements", { method: "POST", body: JSON.stringify({ user_id: user.id, ...payload }) });
        }
      }

      const rewards = milestones.map((r) => ({
        ...r,
        unlocked: granted.some((g: any) => Number(g.milestone) === r.milestone),
        progress: Math.min(activated, r.milestone),
      }));
      const code = referralCode(user.telegram_id);
      return json({ ok: true, code, invited: rows.length, activated, rewards });
    }

    if (action === "entitlements") {
      const [rewards, paidRewards, uses] = await Promise.all([
        db(`referral_rewards?user_id=eq.${encodeURIComponent(user.id)}&select=reward_type,reward_amount,granted_at`) ?? [],
        db(`paid_rewards?user_id=eq.${encodeURIComponent(user.id)}&select=reward_type,reward_amount,granted_at`) ?? [],
        db(`reward_uses?user_id=eq.${encodeURIComponent(user.id)}&select=reward_type,reward_amount,used_at`) ?? [],
      ]);
      const sum = (rows: any[], type: string) => rows.filter((x: any) => String(x.reward_type).toLowerCase() === type).reduce((n: number, x: any) => n + Number(x.reward_amount || 0), 0);
      const earnedSupervybe = sum(rewards, "supervybe") + sum(paidRewards, "supervybe");
      const usedSupervybe = sum(uses, "supervybe");
      const earnedSpotlight = sum(rewards, "spotlight") + sum(paidRewards, "spotlight");
      const usedSpotlight = sum(uses, "spotlight");
      const supervybe = Math.max(0, earnedSupervybe - usedSupervybe);
      const spotlight = Math.max(0, earnedSpotlight - usedSpotlight);
      const plusRows = await db(`user_entitlements?user_id=eq.${encodeURIComponent(user.id)}&select=vybe_plus_until,spotlight_until&limit=1`) ?? [];
      const vybePlusUntil = plusRows?.[0]?.vybe_plus_until ?? null;
      const spotlightUntil = plusRows?.[0]?.spotlight_until ?? null;
      console.log("entitlements:balance", {
        telegram_id: user.telegram_id,
        user_id: user.id,
        earned_supervybe: earnedSupervybe,
        used_supervybe: usedSupervybe,
        supervybe,
        earned_spotlight: earnedSpotlight,
        used_spotlight: usedSpotlight,
        spotlight,
      });
      return json({
        ok: true,
        balances: { supervybe, spotlight },
        earned: { supervybe: earnedSupervybe, spotlight: earnedSpotlight },
        used: { supervybe: usedSupervybe, spotlight: usedSpotlight },
        vybe_plus_until: vybePlusUntil,
        spotlight_until: spotlightUntil,
      });
    }

    if (action === "support_create") {
      const category = body.category === "payment" ? "payment" : "general";
      const message = clean(body.message, 1500);
      if (message.length < 3) return json({ ok: false, error: "Message is too short" }, 400);

      const latest = await db(
        `support_tickets?user_id=eq.${encodeURIComponent(user.id)}&select=created_at&order=created_at.desc&limit=1`,
      ) ?? [];
      if (latest?.[0]?.created_at && Date.now() - new Date(latest[0].created_at).getTime() < 120000) {
        return json({ ok: false, error: "Please wait before sending another request" }, 429);
      }

      const rows = await db("support_tickets", {
        method: "POST",
        body: JSON.stringify({
          user_id: user.id,
          telegram_id: Number(user.telegram_id),
          category,
          message,
          status: "open",
          updated_at: new Date().toISOString(),
        }),
      });
      const ticket = rows?.[0];
      if (ticket?.id) await notifySupportAdmins(db, botToken, String(ticket.id), category);
      console.log("support:create", { user_id: user.id, category, ticket_id: ticket?.id ?? null });
      return json({ ok: true, ticket_id: ticket?.id ?? null, status: ticket?.status ?? "open" });
    }

    if (action === "support_counts") {
      const [mine, notificationRows] = await Promise.all([
        db(
          `support_tickets?user_id=eq.${encodeURIComponent(user.id)}&select=id,reply_sent_at,user_seen_at,status,created_at&order=created_at.desc&limit=100`,
        ) ?? [],
        db(
          `notification_events?recipient_user_id=eq.${encodeURIComponent(user.id)}&seen_at=is.null&select=id&limit=100`,
        ) ?? [],
      ]);
      const userUnread = (mine ?? []).filter((t: any) =>
        !!t.reply_sent_at && (!t.user_seen_at || new Date(t.user_seen_at).getTime() < new Date(t.reply_sent_at).getTime())
      ).length;
      const notificationUnread = (notificationRows ?? []).length;

      const adminRole = await getAdminRole(db, user.id);
      let adminUnread = 0;
      let moderationUnread = 0;
      if (adminRole) {
        const [adminRows, reportRows] = await Promise.all([
          db("support_tickets?select=id,status,admin_seen_at,created_at&order=created_at.desc&limit=300") ?? [],
          db("reports?select=id,status,admin_seen_at,created_at&order=created_at.desc&limit=500") ?? [],
        ]);
        adminUnread = (adminRows ?? []).filter((t: any) =>
          (t.status === "open" || t.status === "reviewed") && !t.admin_seen_at
        ).length;
        moderationUnread = (reportRows ?? []).filter((r: any) =>
          (r.status === "open" || r.status === "reviewed") && !r.admin_seen_at
        ).length;
      }

      return json({
        ok: true,
        user_unread: userUnread,
        admin_unread: adminUnread,
        moderation_unread: moderationUnread,
        notification_unread: notificationUnread,
        admin_role: adminRole,
        account_status: user.account_status ?? "active",
        restriction_reason: user.restriction_reason ?? null,
        restricted_at: user.restricted_at ?? null,
      });
    }

    if (action === "support_mark_seen") {
      const ids = Array.isArray(body.ticket_ids)
        ? [...new Set(body.ticket_ids.map((x: unknown) => clean(x, 80)).filter(Boolean))].slice(0, 20)
        : [];
      if (!ids.length) return json({ ok: true, marked: 0 });

      const now = new Date().toISOString();
      let marked = 0;
      for (const id of ids) {
        const rows = await db(
          `support_tickets?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}&reply_sent_at=not.is.null`,
          { method: "PATCH", body: JSON.stringify({ user_seen_at: now }) },
        ) ?? [];
        marked += rows.length;
      }
      return json({ ok: true, marked });
    }

    if (action === "support_my") {
      const rows = await db(
        `support_tickets?user_id=eq.${encodeURIComponent(user.id)}&select=id,category,message,status,created_at,reviewed_at,reply_text,reply_sent_at,user_seen_at,resolved_at,updated_at&order=created_at.desc&limit=20`,
      ) ?? [];
      const tickets = (rows ?? []).map((t: any) => ({
        ...t,
        unread_reply: !!t.reply_sent_at && (!t.user_seen_at || new Date(t.user_seen_at).getTime() < new Date(t.reply_sent_at).getTime()),
      }));
      return json({ ok: true, tickets });
    }

    if (action === "admin_support_mark_seen") {
      const adminRole = await getAdminRole(db, user.id);
      if (!adminRole) return json({ ok: false, error: "Admin access required" }, 403);
      const ticketId = clean(body.ticket_id, 80);
      if (!ticketId) return json({ ok: false, error: "Ticket is required" }, 400);
      const rows = await db(
        `support_tickets?id=eq.${encodeURIComponent(ticketId)}`,
        { method: "PATCH", body: JSON.stringify({ admin_seen_at: new Date().toISOString() }) },
      ) ?? [];
      return json({ ok: true, marked: rows.length });
    }

    if (action === "admin_moderation_mark_seen") {
      const adminRole = await getAdminRole(db, user.id);
      if (!adminRole) return json({ ok: false, error: "Admin access required" }, 403);
      const reportId = clean(body.report_id, 80);
      if (!reportId) return json({ ok: false, error: "Report is required" }, 400);
      const rows = await db(
        `reports?id=eq.${encodeURIComponent(reportId)}`,
        { method: "PATCH", body: JSON.stringify({ admin_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() }) },
      ) ?? [];
      return json({ ok: true, marked: rows.length });
    }

    if (action === "admin_moderation_list") {
      const adminRole = await getAdminRole(db, user.id);
      if (!adminRole) return json({ ok: false, error: "Admin access required" }, 403);

      const reports = await db(
        "reports?select=id,reporter_id,reported_id,reason,details,status,created_at,reviewed_at,resolved_at,updated_at,admin_note,resolved_by,admin_seen_at,block_requested&order=created_at.desc&limit=500",
      ) ?? [];
      const userIds = [...new Set((reports ?? []).flatMap((r: any) => [String(r.reporter_id || ""), String(r.reported_id || "")]).filter(Boolean))];
      const [users, profiles] = await Promise.all([
        userIds.length
          ? db(`users?id=in.(${userIds.map((x) => encodeURIComponent(x)).join(",")})&select=id,telegram_id,username,first_name,account_status,restricted_at,restriction_reason`) ?? []
          : [],
        userIds.length
          ? db(`profiles?user_id=in.(${userIds.map((x) => encodeURIComponent(x)).join(",")})&select=user_id,name,age,city,photo_url,verified`) ?? []
          : [],
      ]);
      const moderationPhotos = await signProfilePhotoUrls((profiles ?? []).map((x: any) => x.photo_url ?? null));
      const signedProfiles = (profiles ?? []).map((p: any) => withSignedProfilePhoto(p, moderationPhotos));
      const userById = new Map((users ?? []).map((x: any) => [String(x.id), x]));
      const profileById = new Map((signedProfiles ?? []).map((x: any) => [String(x.user_id), x]));
      const decorate = (id: string) => {
        const u = userById.get(id) ?? {};
        const p = profileById.get(id) ?? {};
        return {
          id,
          name: p.name || u.first_name || "VYBE user",
          age: p.age ?? null,
          city: p.city ?? null,
          username: u.username ?? null,
          photo_url: p.photo_url ?? null,
          verified: p.verified === true,
          account_status: u.account_status || "active",
          restricted_at: u.restricted_at ?? null,
          restriction_reason: u.restriction_reason ?? null,
        };
      };
      const decorated = (reports ?? []).map((r: any) => ({
        ...r,
        reporter: decorate(String(r.reporter_id)),
        reported: decorate(String(r.reported_id)),
      }));
      const counts = decorated.reduce((acc: any, r: any) => {
        acc.total += 1;
        acc[r.status] = (acc[r.status] || 0) + 1;
        acc[r.reason] = (acc[r.reason] || 0) + 1;
        return acc;
      }, {
        total:0,open:0,reviewed:0,resolved:0,dismissed:0,
        fake_profile:0,spam:0,harassment:0,underage:0,sexual_services:0,illegal_content:0,other:0,
      });
      return json({ ok: true, admin_role: adminRole, counts, reports: decorated });
    }

    if (action === "admin_moderation_update") {
      const adminRole = await getAdminRole(db, user.id);
      if (!adminRole) return json({ ok: false, error: "Admin access required" }, 403);
      const reportId = clean(body.report_id, 80);
      const nextStatus = ["open","reviewed","resolved","dismissed"].includes(String(body.status)) ? String(body.status) : "";
      const adminNote = clean(body.admin_note, 1000);
      if (!reportId || !nextStatus) return json({ ok: false, error: "Invalid moderation update" }, 400);

      const rows = await db(
        `reports?id=eq.${encodeURIComponent(reportId)}&select=id,reporter_id,reported_id,reason,status&limit=1`,
      ) ?? [];
      const report = rows?.[0];
      if (!report) return json({ ok:false,error:"Report not found" },404);
      const now = new Date().toISOString();
      const payload: Record<string,unknown> = {
        status: nextStatus,
        updated_at: now,
        admin_seen_at: now,
        admin_note: adminNote || null,
      };
      if (nextStatus === "reviewed") {
        payload.reviewed_at = now;
        payload.resolved_at = null;
        payload.resolved_by = null;
      } else if (nextStatus === "resolved" || nextStatus === "dismissed") {
        payload.reviewed_at = now;
        payload.resolved_at = now;
        payload.resolved_by = user.id;
      } else {
        payload.reviewed_at = null;
        payload.resolved_at = null;
        payload.resolved_by = null;
      }
      await db(`reports?id=eq.${encodeURIComponent(reportId)}`, {
        method:"PATCH",
        body:JSON.stringify(payload),
      });
      await db("admin_audit_log", {
        method:"POST",
        body:JSON.stringify({
          actor_user_id:user.id,
          action:"moderation_report_update",
          target_report_id:report.id,
          target_user_id:report.reported_id,
          metadata:{previous_status:report.status,status:nextStatus,reason:report.reason,admin_role:adminRole},
        }),
      });

      if (
        (nextStatus === "resolved" || nextStatus === "dismissed") &&
        report.status !== "resolved" &&
        report.status !== "dismissed" &&
        report.reporter_id
      ) {
        await notifyReporterReviewed(db,botToken,String(report.reporter_id),String(report.id));
      }

      return json({ok:true,report_id:report.id,status:nextStatus});
    }

    if (action === "admin_moderation_restrict") {
      const adminRole = await getAdminRole(db, user.id);
      if (adminRole !== "owner") return json({ ok:false,error:"Owner access required" },403);
      const reportId = clean(body.report_id,80);
      const targetUserId = clean(body.target_user_id,80);
      const mode = body.mode === "restore" ? "restore" : "restrict";
      const confirmation = clean(body.confirmation,40);
      if (!targetUserId || confirmation !== (mode === "restore" ? "RESTORE" : "RESTRICT")) {
        return json({ok:false,error:"Confirmation required"},400);
      }
      if (targetUserId === String(user.id)) return json({ok:false,error:"Cannot restrict owner account"},400);

      const targetRows = await db(
        `users?id=eq.${encodeURIComponent(targetUserId)}&select=id,telegram_id,account_status,restriction_reason&limit=1`,
      ) ?? [];
      const target = targetRows?.[0];
      if (!target) return json({ok:false,error:"User not found"},404);

      const now = new Date().toISOString();
      let linkedReporterId: string | null = null;
      const reasonLabels: Record<string,string> = {
        fake_profile:"fake profile / фейковий профіль",
        spam:"spam or fraud / спам або шахрайство",
        harassment:"harassment / переслідування",
        underage:"suspected minor / підозра на неповнолітнього",
        sexual_services:"sexual services / сексуальні послуги",
        illegal_content:"illegal or dangerous content / незаконний або небезпечний контент",
        other:"moderation review / модерація",
        moderation:"moderation review / модерація",
      };

      if (mode === "restore") {
        await db(`users?id=eq.${encodeURIComponent(targetUserId)}`, {
          method:"PATCH",
          body:JSON.stringify({
            account_status:"active",
            restricted_at:null,
            restriction_reason:null,
            restricted_by:null,
          }),
        });

        try {
          await telegramApi(botToken,"sendMessage",{
            chat_id:Number(target.telegram_id),
            text:"VYBE 🛡\n\nYour access has been restored. / Доступ до VYBE відновлено.",
            reply_markup:{
              inline_keyboard:[[{text:"Open VYBE / Відкрити VYBE",web_app:{url:"https://restsva-ui.github.io/vibe-app/"}}]],
            },
          });
        } catch {
          console.warn("moderation:restore_notify_failed",{user_id:targetUserId});
        }
      } else {
        let reason = clean(body.reason,120) || "moderation";
        if (reportId) {
          const rows = await db(`reports?id=eq.${encodeURIComponent(reportId)}&select=reason,reporter_id,status&limit=1`) ?? [];
          if (rows?.[0]?.reason) reason = String(rows[0].reason);
          if (rows?.[0]?.reporter_id) linkedReporterId = String(rows[0].reporter_id);
        }
        await db(`users?id=eq.${encodeURIComponent(targetUserId)}`, {
          method:"PATCH",
          body:JSON.stringify({
            account_status:"restricted",
            restricted_at:now,
            restriction_reason:reason,
            restricted_by:user.id,
          }),
        });
        if (reportId) {
          await db(`reports?id=eq.${encodeURIComponent(reportId)}`, {
            method:"PATCH",
            body:JSON.stringify({
              status:"resolved",
              reviewed_at:now,
              resolved_at:now,
              resolved_by:user.id,
              admin_seen_at:now,
              updated_at:now,
            }),
          });
        }

        try {
          await telegramApi(botToken,"sendMessage",{
            chat_id:Number(target.telegram_id),
            text:`VYBE 🛡\n\nYour account access is temporarily restricted. / Доступ до акаунта тимчасово обмежено.\nReason / Причина: ${reasonLabels[reason] || reason}\n\nYou can contact support from VYBE. / Ти можеш звернутися у підтримку через VYBE.`,
            reply_markup:{
              inline_keyboard:[[{text:"Support / Підтримка",web_app:{url:"https://restsva-ui.github.io/vibe-app/?support=ticket"}}]],
            },
          });
        } catch {
          console.warn("moderation:restrict_notify_failed",{user_id:targetUserId});
        }
      }

      await db("admin_audit_log", {
        method:"POST",
        body:JSON.stringify({
          actor_user_id:user.id,
          action:mode === "restore" ? "moderation_user_restore" : "moderation_user_restrict",
          target_report_id:reportId || null,
          target_user_id:targetUserId,
          metadata:{previous_status:target.account_status,status:mode === "restore" ? "active" : "restricted",admin_role:adminRole},
        }),
      });

      await recordNotificationEvent(db,{
        eventType:"system",
        recipientUserId:targetUserId,
        sourceKey:`moderation:${mode}:${targetUserId}:${Date.now()}`,
        payload:{
          kind:mode === "restore" ? "account_restored" : "account_restricted",
          reason:mode === "restore" ? null : (clean(body.reason,120) || "moderation"),
        },
      });

      if (mode === "restrict" && reportId && linkedReporterId) {
        await notifyReporterReviewed(db,botToken,linkedReporterId,reportId);
      }

      return json({ok:true,user_id:targetUserId,account_status:mode === "restore" ? "active" : "restricted"});
    }

    if (action === "admin_support_list") {
      const adminRole = await getAdminRole(db, user.id);
      if (!adminRole) return json({ ok: false, error: "Admin access required" }, 403);

      const [tickets, orders] = await Promise.all([
        db("support_tickets?select=id,user_id,telegram_id,category,message,status,created_at,reviewed_at,updated_at,admin_note,reply_text,reply_sent_at,user_seen_at,admin_seen_at,resolved_at,resolved_by&order=created_at.desc&limit=300") ?? [],
        db("star_orders?select=id,user_id,telegram_id,product_key,status,total_amount,created_at,paid_at,refunded_at&order=created_at.desc&limit=1000") ?? [],
      ]);

      const userIds = [...new Set((tickets ?? []).map((t: any) => String(t.user_id || "")).filter(Boolean))];
      const users = userIds.length
        ? await db(`users?id=in.(${userIds.map((x) => encodeURIComponent(x)).join(",")})&select=id,username,first_name`) ?? []
        : [];
      const profiles = userIds.length
        ? await db(`profiles?user_id=in.(${userIds.map((x) => encodeURIComponent(x)).join(",")})&select=user_id,name`) ?? []
        : [];

      const userById = new Map((users ?? []).map((x: any) => [String(x.id), x]));
      const profileById = new Map((profiles ?? []).map((x: any) => [String(x.user_id), x]));
      const latestOrderByTelegram = new Map<string, any>();
      for (const o of orders ?? []) {
        const key = String(o.telegram_id);
        if (!latestOrderByTelegram.has(key)) latestOrderByTelegram.set(key, o);
      }

      const decorated = (tickets ?? []).map((t: any) => {
        const u = userById.get(String(t.user_id)) ?? null;
        const p = profileById.get(String(t.user_id)) ?? null;
        const order = latestOrderByTelegram.get(String(t.telegram_id)) ?? null;
        return {
          ...t,
          user: {
            name: p?.name || u?.first_name || "VYBE user",
            username: u?.username || null,
          },
          latest_order: order ? {
            id: order.id,
            product_key: order.product_key,
            status: order.status,
            stars: Number(order.total_amount || 0),
            created_at: order.created_at,
            paid_at: order.paid_at,
            refunded_at: order.refunded_at,
          } : null,
        };
      });

      const counts = (tickets ?? []).reduce((acc: any, t: any) => {
        acc.total += 1;
        acc[t.status] = (acc[t.status] || 0) + 1;
        acc[t.category] = (acc[t.category] || 0) + 1;
        return acc;
      }, { total: 0, open: 0, reviewed: 0, resolved: 0, general: 0, payment: 0 });

      return json({ ok: true, admin_role: adminRole, counts, tickets: decorated });
    }

    if (action === "admin_support_update") {
      const adminRole = await getAdminRole(db, user.id);
      if (!adminRole) return json({ ok: false, error: "Admin access required" }, 403);

      const ticketId = clean(body.ticket_id, 80);
      const nextStatus = ["open","reviewed","resolved"].includes(String(body.status)) ? String(body.status) : "";
      const adminNote = clean(body.admin_note, 1000);
      const replyText = clean(body.reply_text, 1500);
      const operationId = clean(body.operation_id, 100) || crypto.randomUUID();
      if (!ticketId || !nextStatus) return json({ ok: false, error: "Invalid support update" }, 400);
      if (replyText && nextStatus !== "resolved") {
        return json({ ok: false, error: "Replies must resolve the ticket" }, 400);
      }

      const rows = await db(
        `support_tickets?id=eq.${encodeURIComponent(ticketId)}&select=id,user_id,telegram_id,category,message,status,created_at,reply_text,reply_sent_at,reply_dispatch_key&limit=1`,
      ) ?? [];
      const ticket = rows?.[0];
      if (!ticket) return json({ ok: false, error: "Ticket not found" }, 404);

      if (replyText && ticket.reply_sent_at) {
        return json({
          ok: true,
          ticket_id: ticket.id,
          status: ticket.status,
          replied: true,
          duplicate_prevented: true,
        });
      }

      const now = new Date().toISOString();

      if (replyText) {
        const claimed = await db(
          `support_tickets?id=eq.${encodeURIComponent(ticketId)}&reply_sent_at=is.null&reply_dispatch_key=is.null`,
          {
            method: "PATCH",
            body: JSON.stringify({
              reply_dispatch_key: operationId,
              admin_seen_at: now,
              updated_at: now,
            }),
          },
        ) ?? [];

        if (!claimed.length) {
          return json({ ok: false, error: "Reply is already being processed" }, 409);
        }

        try {
          await telegramApi(botToken, "sendMessage", {
            chat_id: Number(ticket.telegram_id),
            text: `VYBE Support / Підтримка VYBE:\n\n${replyText}`,
            reply_markup: {
              inline_keyboard: [[{
                text: "Open request / Відкрити звернення",
                web_app: { url: `https://restsva-ui.github.io/vibe-app/?support=ticket&ticket=${encodeURIComponent(String(ticket.id))}` },
              }]],
            },
          });
        } catch (e) {
          await db(
            `support_tickets?id=eq.${encodeURIComponent(ticketId)}&reply_dispatch_key=eq.${encodeURIComponent(operationId)}&reply_sent_at=is.null`,
            { method: "PATCH", body: JSON.stringify({ reply_dispatch_key: null, updated_at: new Date().toISOString() }) },
          );
          throw e;
        }

        const sentAt = new Date().toISOString();
        await db(`support_tickets?id=eq.${encodeURIComponent(ticketId)}`, {
          method: "PATCH",
          body: JSON.stringify({
            status: "resolved",
            reviewed_at: sentAt,
            resolved_at: sentAt,
            resolved_by: user.id,
            updated_at: sentAt,
            admin_seen_at: sentAt,
            admin_note: adminNote || null,
            reply_text: replyText,
            reply_sent_at: sentAt,
            user_seen_at: null,
          }),
        });
      } else {
        const payload: Record<string, unknown> = {
          status: nextStatus,
          updated_at: now,
          admin_seen_at: now,
          admin_note: adminNote || null,
        };
        if (nextStatus === "reviewed") {
          payload.reviewed_at = now;
          payload.resolved_at = null;
          payload.resolved_by = null;
        } else if (nextStatus === "resolved") {
          payload.reviewed_at = now;
          payload.resolved_at = now;
          payload.resolved_by = user.id;
        } else {
          payload.reviewed_at = null;
          payload.resolved_at = null;
          payload.resolved_by = null;
        }

        await db(`support_tickets?id=eq.${encodeURIComponent(ticketId)}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }

      await db("admin_audit_log", {
        method: "POST",
        body: JSON.stringify({
          actor_user_id: user.id,
          action: "support_ticket_update",
          target_ticket_id: ticket.id,
          metadata: {
            previous_status: ticket.status,
            status: replyText ? "resolved" : nextStatus,
            category: ticket.category,
            replied: !!replyText,
            operation_id: operationId,
            admin_role: adminRole,
          },
        }),
      });

      if (replyText) {
        await recordNotificationEvent(db,{
          eventType:"system",
          recipientUserId:String(ticket.user_id),
          sourceKey:`support_reply:${ticket.id}`,
          payload:{kind:"support_reply",ticket_id:String(ticket.id)},
        });
      }

      console.log("admin:support_ticket_update", {
        actor_user_id: user.id,
        ticket_id: ticket.id,
        status: replyText ? "resolved" : nextStatus,
        replied: !!replyText,
      });

      return json({
        ok: true,
        ticket_id: ticket.id,
        status: replyText ? "resolved" : nextStatus,
        replied: !!replyText,
        duplicate_prevented: false,
      });
    }

    if (action === "admin_finance_summary") {
      const adminRole = await getAdminRole(db, user.id);
      if (!adminRole) return json({ ok: false, error: "Admin access required" }, 403);

      const [botBalance, telegramTransactions, orders, products, auditRows] = await Promise.all([
        telegramApi(botToken, "getMyStarBalance", {}),
        telegramApi(botToken, "getStarTransactions", { offset: 0, limit: 100 }),
        db("star_orders?select=id,product_key,status,total_amount,created_at,paid_at,refunded_at,telegram_payment_charge_id&order=created_at.desc&limit=1000") ?? [],
        db("star_products?select=product_key,title_uk,title_en,stars&order=sort_order.asc") ?? [],
        db("admin_audit_log?action=eq.refund_star_order&select=id,target_order_id,metadata,created_at&order=created_at.desc&limit=100") ?? [],
      ]);

      const productByKey = new Map((products ?? []).map((p: any) => [String(p.product_key), p]));
      const rawTransactions = Array.isArray(telegramTransactions?.transactions)
        ? telegramTransactions.transactions
        : [];
      const transactions = rawTransactions.map(safeTelegramStarTransaction);
      const transactionIds = new Set(transactions.map((x: any) => x.id).filter(Boolean));
      const recentChargeOrders = (orders ?? [])
        .filter((o: any) => (o.status === "paid" || o.status === "refunded") && o.telegram_payment_charge_id)
        .slice(0, 100);

      const reconciliation = {
        scope: "latest_100_telegram_transactions",
        checked_orders: recentChargeOrders.length,
        matched_orders: recentChargeOrders.filter((o: any) => transactionIds.has(String(o.telegram_payment_charge_id))).length,
        unmatched_order_ids: recentChargeOrders
          .filter((o: any) => !transactionIds.has(String(o.telegram_payment_charge_id)))
          .slice(0, 20)
          .map((o: any) => String(o.id)),
      };

      const decorateOrder = (o: any) => {
        const p = productByKey.get(String(o.product_key));
        return {
          id: o.id,
          product_key: o.product_key,
          title_uk: p?.title_uk ?? o.product_key,
          title_en: p?.title_en ?? o.product_key,
          stars: Number(o.total_amount || 0),
          status: o.status,
          created_at: o.created_at,
          paid_at: o.paid_at,
          refunded_at: o.refunded_at,
        };
      };

      const successfulOrders = (orders ?? [])
        .filter((o: any) => o.status === "paid" || o.status === "refunded")
        .slice(0, 30)
        .map(decorateOrder);

      const attemptOrders = (orders ?? [])
        .filter((o: any) => !["paid", "refunded"].includes(String(o.status)))
        .slice(0, 30)
        .map(decorateOrder);

      const statusCounts = (orders ?? []).reduce((acc: Record<string, number>, o: any) => {
        const key = String(o.status || "unknown");
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      const productStats = new Map<string, any>();
      for (const p of products ?? []) {
        productStats.set(String(p.product_key), {
          product_key: String(p.product_key),
          title_uk: p.title_uk,
          title_en: p.title_en,
          current_price_stars: Number(p.stars || 0),
          attempts: 0,
          paid_orders: 0,
          refund_orders: 0,
          gross_stars: 0,
          refunded_stars: 0,
          net_stars: 0,
        });
      }
      for (const o of orders ?? []) {
        const key = String(o.product_key);
        const stat = productStats.get(key) ?? {
          product_key: key,
          title_uk: key,
          title_en: key,
          current_price_stars: Number(o.total_amount || 0),
          attempts: 0,
          paid_orders: 0,
          refund_orders: 0,
          gross_stars: 0,
          refunded_stars: 0,
          net_stars: 0,
        };
        stat.attempts += 1;
        if (o.status === "paid" || o.status === "refunded") {
          stat.paid_orders += 1;
          stat.gross_stars += Number(o.total_amount || 0);
        }
        if (o.status === "refunded") {
          stat.refund_orders += 1;
          stat.refunded_stars += Number(o.total_amount || 0);
        }
        stat.net_stars = stat.gross_stars - stat.refunded_stars;
        productStats.set(key, stat);
      }

      const auditByOrder = new Map((auditRows ?? []).map((x: any) => [String(x.target_order_id), x]));
      const refundHistory = (orders ?? [])
        .filter((o: any) => o.status === "refunded")
        .slice(0, 50)
        .map((o: any) => {
          const audit = auditByOrder.get(String(o.id));
          const p = productByKey.get(String(o.product_key));
          return {
            order_id: o.id,
            product_key: o.product_key,
            title_uk: p?.title_uk ?? o.product_key,
            title_en: p?.title_en ?? o.product_key,
            stars: Number(o.total_amount || 0),
            refunded_at: o.refunded_at,
            source: audit ? "owner" : "automatic",
            audit_created_at: audit?.created_at ?? null,
          };
        });

      return json({
        ok: true,
        admin_role: adminRole,
        telegram_balance: {
          amount: Number(botBalance?.amount ?? 0),
          nanostar_amount: Number(botBalance?.nanostar_amount ?? 0),
        },
        sales: summarizeStarOrders(orders ?? []),
        order_status_counts: statusCounts,
        product_breakdown: [...productStats.values()].sort((a: any, b: any) => b.net_stars - a.net_stars || b.gross_stars - a.gross_stars),
        recent_orders: successfulOrders,
        recent_attempts: attemptOrders,
        refund_history: refundHistory,
        telegram_transactions: transactions.slice(0, 50),
        reconciliation,
        withdrawal: {
          owner_only: true,
          method: "telegram_owner_fragment",
          direct_from_bot_api: false,
          current_balance_stars: Number(botBalance?.amount ?? 0),
        },
      });
    }

    if (action === "admin_finance_reconcile") {
      const adminRole = await getAdminRole(db, user.id);
      if (adminRole !== "owner") return json({ ok: false, error: "Owner access required" }, 403);

      const repairRequested = body.repair_refunds === true;
      const confirmation = clean(body.confirmation, 80);
      if (repairRequested && confirmation !== "RECONCILE_REFUNDS") {
        return json({ ok: false, error: "Reconciliation confirmation required" }, 400);
      }

      const [telegramScan, orders, paidRewards] = await Promise.all([
        fetchTelegramStarTransactions(botToken, 1000),
        db(
          "star_orders?select=id,user_id,telegram_id,product_key,invoice_payload,status,total_amount,grant_type,grant_amount,telegram_payment_charge_id,created_at,paid_at,refunded_at,refund_requested_at&order=created_at.desc&limit=5000",
        ) ?? [],
        db("paid_rewards?select=source_order_id,reward_type,reward_amount,granted_at&limit=10000") ?? [],
      ]);

      let report = buildFinanceReconciliation(orders ?? [], telegramScan, paidRewards ?? []);
      const repaired: string[] = [];
      const repairErrors: any[] = [];

      if (repairRequested && report.repairable_orders.length) {
        for (const order of report.repairable_orders) {
          try {
            await rpc("apply_star_refund", {
              p_payload: String(order.invoice_payload || ""),
              p_telegram_id: Number(order.telegram_id),
              p_currency: "XTR",
              p_total_amount: Number(order.total_amount || 0),
              p_charge_id: String(order.telegram_payment_charge_id || ""),
            });
            repaired.push(String(order.id));
          } catch (e) {
            repairErrors.push({
              order_id: String(order.id),
              error: String(e instanceof Error ? e.message : e).slice(0, 180),
            });
          }
        }

        const [freshOrders, freshPaidRewards] = await Promise.all([
          db(
            "star_orders?select=id,user_id,telegram_id,product_key,invoice_payload,status,total_amount,grant_type,grant_amount,telegram_payment_charge_id,created_at,paid_at,refunded_at,refund_requested_at&order=created_at.desc&limit=5000",
          ) ?? [],
          db("paid_rewards?select=source_order_id,reward_type,reward_amount,granted_at&limit=10000") ?? [],
        ]);
        report = buildFinanceReconciliation(freshOrders ?? [], telegramScan, freshPaidRewards ?? []);

        await db("admin_audit_log", {
          method: "POST",
          body: JSON.stringify({
            actor_user_id: user.id,
            action: "finance_reconcile",
            metadata: {
              repaired_order_ids: repaired,
              repair_errors: repairErrors,
              telegram_transactions_fetched: telegramScan.fetched,
              telegram_history_complete: telegramScan.complete,
              issue_count_after: report.summary.issue_count,
              critical_count_after: report.summary.critical_count,
            },
          }),
        });
      }

      return json({
        ok: true,
        admin_role: adminRole,
        repaired_order_ids: repaired,
        repair_errors: repairErrors,
        ...report,
      });
    }

    if (action === "admin_finance_export") {
      const adminRole = await getAdminRole(db, user.id);
      if (!adminRole) return json({ ok: false, error: "Admin access required" }, 403);

      const orders = await db(
        "star_orders?select=id,product_key,status,total_amount,created_at,paid_at,refunded_at&order=created_at.desc&limit=5000",
      ) ?? [];

      const escCsv = (value: unknown) => {
        const raw = String(value ?? "");
        return `"${raw.replaceAll('"', '""')}"`;
      };
      const header = [
        "order_id",
        "product_key",
        "status",
        "stars",
        "created_at",
        "paid_at",
        "refunded_at",
        "net_stars",
      ].join(",");
      const rows = (orders ?? []).map((o: any) => {
        const amount = Number(o.total_amount || 0);
        const net = o.status === "paid" ? amount : 0;
        return [
          escCsv(o.id),
          escCsv(o.product_key),
          escCsv(o.status),
          amount,
          escCsv(o.created_at),
          escCsv(o.paid_at),
          escCsv(o.refunded_at),
          net,
        ].join(",");
      });

      await db("admin_audit_log", {
        method: "POST",
        body: JSON.stringify({
          actor_user_id: user.id,
          action: "export_star_orders",
          metadata: {
            rows: rows.length,
            admin_role: adminRole,
          },
        }),
      });

      return json({
        ok: true,
        filename: `vybe-stars-${new Date().toISOString().slice(0, 10)}.csv`,
        csv: [header, ...rows].join("\n"),
        rows: rows.length,
      });
    }

    if (action === "admin_test_reset_match") {
      const adminRole = await getAdminRole(db, user.id);
      if (adminRole !== "owner") return json({ ok:false,error:"Owner access required" },403);

      const matchId = clean(body.match_id,80);
      const confirmation = clean(body.confirmation,40);
      if (!matchId || confirmation !== "RESET_TEST_MATCH") {
        return json({ok:false,error:"Reset confirmation required"},400);
      }

      const matchRows = await db(
        `matches?id=eq.${encodeURIComponent(matchId)}&or=(user_a_id.eq.${encodeURIComponent(user.id)},user_b_id.eq.${encodeURIComponent(user.id)})&select=id,user_a_id,user_b_id&limit=1`,
      ) ?? [];
      const match = matchRows?.[0];
      if (!match) return json({ok:false,error:"Owner test match not found"},404);

      const otherUserId = String(match.user_a_id) === String(user.id)
        ? String(match.user_b_id)
        : String(match.user_a_id);

      const removed: Record<string,number> = {};
      const remove = async (key:string,path:string) => {
        const rows = await db(path,{method:"DELETE"}) ?? [];
        removed[key] = Array.isArray(rows) ? rows.length : 0;
      };

      await remove("notification_deliveries",`notification_deliveries?match_id=eq.${encodeURIComponent(matchId)}`);
      await remove("notification_events",`notification_events?match_id=eq.${encodeURIComponent(matchId)}`);

      await remove(
        "like_deliveries_owner_to_peer",
        `notification_deliveries?event_type=eq.like&actor_user_id=eq.${encodeURIComponent(user.id)}&recipient_user_id=eq.${encodeURIComponent(otherUserId)}`,
      );
      await remove(
        "like_deliveries_peer_to_owner",
        `notification_deliveries?event_type=eq.like&actor_user_id=eq.${encodeURIComponent(otherUserId)}&recipient_user_id=eq.${encodeURIComponent(user.id)}`,
      );
      await remove(
        "like_events_owner_to_peer",
        `notification_events?event_type=eq.like&actor_user_id=eq.${encodeURIComponent(user.id)}&recipient_user_id=eq.${encodeURIComponent(otherUserId)}`,
      );
      await remove(
        "like_events_peer_to_owner",
        `notification_events?event_type=eq.like&actor_user_id=eq.${encodeURIComponent(otherUserId)}&recipient_user_id=eq.${encodeURIComponent(user.id)}`,
      );

      await remove("match_reads",`match_reads?match_id=eq.${encodeURIComponent(matchId)}`);
      await remove("messages",`messages?match_id=eq.${encodeURIComponent(matchId)}`);
      await remove(
        "likes_owner_to_peer",
        `likes?from_user_id=eq.${encodeURIComponent(user.id)}&to_user_id=eq.${encodeURIComponent(otherUserId)}`,
      );
      await remove(
        "likes_peer_to_owner",
        `likes?from_user_id=eq.${encodeURIComponent(otherUserId)}&to_user_id=eq.${encodeURIComponent(user.id)}`,
      );
      await remove(
        "passes_owner_to_peer",
        `discovery_passes?user_id=eq.${encodeURIComponent(user.id)}&target_user_id=eq.${encodeURIComponent(otherUserId)}`,
      );
      await remove(
        "passes_peer_to_owner",
        `discovery_passes?user_id=eq.${encodeURIComponent(otherUserId)}&target_user_id=eq.${encodeURIComponent(user.id)}`,
      );
      await remove("match",`matches?id=eq.${encodeURIComponent(matchId)}`);

      await db("admin_audit_log", {
        method:"POST",
        body:JSON.stringify({
          actor_user_id:user.id,
          action:"test_match_reset",
          target_user_id:otherUserId,
          metadata:{match_id:matchId,removed,admin_role:adminRole},
        }),
      });

      return json({
        ok:true,
        reset:true,
        match_id:matchId,
        target_user_id:otherUserId,
        removed,
        blocked_between:await isBlockedBetween(db,String(user.id),otherUserId),
      });
    }

    if (action === "admin_refund_star_order") {
      const adminRole = await getAdminRole(db, user.id);
      if (adminRole !== "owner") return json({ ok: false, error: "Owner access required" }, 403);

      const orderId = clean(body.order_id, 80);
      const confirmation = clean(body.confirmation, 40);
      if (!orderId || confirmation !== "REFUND") {
        return json({ ok: false, error: "Refund confirmation required" }, 400);
      }

      let refund;
      try {
        refund = await requestStarRefund(botToken, orderId);
      } catch (e) {
        console.error("admin:refund_star_order_failed", {
          actor_user_id: user.id,
          order_id: orderId,
          error: String(e instanceof Error ? e.message : e).slice(0, 180),
        });
        return json({ ok: false, error: "Refund failed" }, 502);
      }

      await db("admin_audit_log", {
        method: "POST",
        body: JSON.stringify({
          actor_user_id: user.id,
          action: "refund_star_order",
          target_order_id: orderId,
          metadata: {
            refunded: refund?.refunded === true,
            refunding: refund?.refunding === true,
            reconciling: refund?.reconciling === true,
            product_key: refund?.product_key ?? null,
            stars: Number(refund?.stars || 0),
            admin_role: adminRole,
          },
        }),
      });

      console.log("admin:refund_star_order", {
        actor_user_id: user.id,
        order_id: orderId,
        refunded: refund?.refunded === true,
        refunding: refund?.refunding === true,
        reconciling: refund?.reconciling === true,
      });

      return json({ ok: true, ...refund });
    }

    if (action === "star_catalog") {
      const products = await db(
        "star_products?active=eq.true&select=product_key,title_uk,title_en,description_uk,description_en,stars,grant_type,grant_amount,sort_order&order=sort_order.asc",
      ) ?? [];
      return json({ ok: true, currency: "XTR", products });
    }

    if (action === "star_invoice") {
      const productKey = clean(body.product_key, 64);
      const language = body.lang === "en" ? "en" : "uk";
      const termsAccepted = body.terms_accepted === true;
      if (!productKey) return json({ ok: false, error: "Product is required" }, 400);
      if (!termsAccepted) return json({ ok: false, error: "Terms acceptance required" }, 409);

      const products = await db(
        `star_products?product_key=eq.${encodeURIComponent(productKey)}&active=eq.true&select=product_key,title_uk,title_en,description_uk,description_en,stars,grant_type,grant_amount&limit=1`,
      ) ?? [];
      const product = products?.[0];
      if (!product) return json({ ok: false, error: "Product not found" }, 404);

      await db(
        `star_orders?user_id=eq.${encodeURIComponent(user.id)}&status=eq.pending`,
        { method: "PATCH", body: JSON.stringify({ status: "expired" }) },
      );

      const orderId = crypto.randomUUID();
      const invoicePayload = `vybe_star:${orderId}`;
      const amount = Number(product.stars);
      await db("star_orders", {
        method: "POST",
        body: JSON.stringify({
          id: orderId,
          user_id: user.id,
          telegram_id: Number(user.telegram_id),
          product_key: product.product_key,
          invoice_payload: invoicePayload,
          currency: "XTR",
          total_amount: amount,
          grant_type: product.grant_type,
          grant_amount: Number(product.grant_amount),
          status: "pending",
          terms_accepted_at: new Date().toISOString(),
          terms_version: "2026-10-03",
        }),
      });

      const title = language === "en" ? product.title_en : product.title_uk;
      const description = language === "en" ? product.description_en : product.description_uk;

      try {
        await ensurePaymentWebhook(botToken);
        const invoiceUrl = await telegramApi(botToken, "createInvoiceLink", {
          title: String(title).slice(0, 32),
          description: String(description).slice(0, 255),
          payload: invoicePayload,
          currency: "XTR",
          prices: [{ label: String(title).slice(0, 32), amount }],
        });
        return json({
          ok: true,
          order_id: orderId,
          product_key: product.product_key,
          currency: "XTR",
          stars: amount,
          invoice_url: invoiceUrl,
          expires_in_seconds: 3600,
        });
      } catch (e) {
        await db(`star_orders?id=eq.${encodeURIComponent(orderId)}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "failed" }),
        });
        throw e;
      }
    }

    if (action === "star_test_refund") {
      const rows = await db(
        `star_orders?user_id=eq.${encodeURIComponent(user.id)}&product_key=eq.test_1_star&status=in.(paid,refunding)&select=id,total_amount,status,paid_at&order=paid_at.desc&limit=1`,
      ) ?? [];
      const order = rows?.[0];
      if (!order?.id) {
        return json({ ok: true, refunded: false, reason: "nothing_to_refund" });
      }

      let refund;
      try {
        refund = await requestStarRefund(botToken, String(order.id));
      } catch (e) {
        console.error("stars:test_refund_failed", {
          user_id: user.id,
          order_id: order.id,
          error: String(e instanceof Error ? e.message : e).slice(0, 180),
        });
        return json({ ok: false, error: "Refund failed" }, 502);
      }

      if (refund?.refunded === true) {
        await db(
          "star_products?product_key=eq.test_1_star",
          {
            method: "PATCH",
            body: JSON.stringify({ active: false, updated_at: new Date().toISOString() }),
          },
        );
      }

      return json({
        ok: true,
        refunded: refund?.refunded === true,
        refunding: refund?.refunding === true,
        reconciling: refund?.reconciling === true,
        stars: Number(refund?.stars || order.total_amount || 1),
        order_id: order.id,
      });
    }

    if (action === "star_order_status") {
      const orderId = clean(body.order_id, 80);
      if (!orderId) return json({ ok: false, error: "Order is required" }, 400);
      const rows = await db(
        `star_orders?id=eq.${encodeURIComponent(orderId)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,product_key,status,currency,total_amount,created_at,expires_at,paid_at&limit=1`,
      ) ?? [];
      const order = rows?.[0];
      if (!order) return json({ ok: false, error: "Order not found" }, 404);

      if (order.status === "pending" && new Date(order.expires_at).getTime() < Date.now()) {
        await db(`star_orders?id=eq.${encodeURIComponent(orderId)}&status=eq.pending`, {
          method: "PATCH",
          body: JSON.stringify({ status: "expired" }),
        });
        order.status = "expired";
      }

      return json({ ok: true, order });
    }

    if (action === "star_order_close") {
      const orderId = clean(body.order_id, 80);
      const requestedStatus = body.status === "failed" ? "failed" : "cancelled";
      if (!orderId) return json({ ok: false, error: "Order is required" }, 400);

      const rows = await db(
        `star_orders?id=eq.${encodeURIComponent(orderId)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,status&limit=1`,
      ) ?? [];
      const order = rows?.[0];
      if (!order) return json({ ok: false, error: "Order not found" }, 404);

      if (order.status === "pending") {
        await db(
          `star_orders?id=eq.${encodeURIComponent(orderId)}&user_id=eq.${encodeURIComponent(user.id)}&status=eq.pending`,
          { method: "PATCH", body: JSON.stringify({ status: requestedStatus }) },
        );
        order.status = requestedStatus;
      }

      return json({ ok: true, order });
    }

    if (action === "likes_received") {
      const nowIso = new Date().toISOString();
      const plusRows = await db(
        `user_entitlements?user_id=eq.${encodeURIComponent(user.id)}&vybe_plus_until=gt.${encodeURIComponent(nowIso)}&select=vybe_plus_until&limit=1`,
      ) ?? [];
      if (!plusRows?.length) return json({ ok: false, error: "VYBE+ required" }, 403);

      const [likes, blockedIds, currentMatches] = await Promise.all([
        db(`likes?to_user_id=eq.${encodeURIComponent(user.id)}&select=from_user_id,kind,created_at&order=created_at.desc&limit=200`) ?? [],
        getBlockedUserIds(db, user.id),
        db(`matches?or=(user_a_id.eq.${encodeURIComponent(user.id)},user_b_id.eq.${encodeURIComponent(user.id)})&select=user_a_id,user_b_id&limit=500`) ?? [],
      ]);
      const matchedIds = new Set((currentMatches ?? []).map((m: any) =>
        String(m.user_a_id) === String(user.id) ? String(m.user_b_id) : String(m.user_a_id)
      ));
      const senderIds = [...new Set((likes ?? [])
        .map((x: any) => String(x.from_user_id))
        .filter((id: string) => !blockedIds.has(id) && !matchedIds.has(id)))];

      if (!senderIds.length) {
        return json({ ok: true, vybe_plus_until: plusRows[0].vybe_plus_until, people: [] });
      }

      const [profiles, statuses] = await Promise.all([
        db(`profiles?user_id=in.(${senderIds.map((x) => encodeURIComponent(x)).join(",")})&select=user_id,name,age,city,bio,photo_url,verified`) ?? [],
        db(`users?id=in.(${senderIds.map((x) => encodeURIComponent(x)).join(",")})&select=id,last_seen,account_status`) ?? [],
      ]);
      const likesPhotos = await signProfilePhotoUrls((profiles ?? []).map((p: any) => p.photo_url ?? null));
      const signedLikeProfiles = (profiles ?? []).map((p: any) => withSignedProfilePhoto(p, likesPhotos));
      const profileById = new Map(signedLikeProfiles.map((p: any) => [String(p.user_id), p]));
      const statusById = new Map(statuses.map((x: any) => [String(x.id), x]));
      const activeSenderIds = senderIds.filter((id) => statusById.get(id)?.account_status !== "restricted");
      const latestLikeByUser = new Map<string, any>();
      for (const like of likes ?? []) {
        const id = String(like.from_user_id);
        if (!activeSenderIds.includes(id) || latestLikeByUser.has(id)) continue;
        latestLikeByUser.set(id, like);
      }

      const people = activeSenderIds.map((id) => ({
        user_id: id,
        profile: {
          ...(profileById.get(id) ?? {}),
          online: !!statusById.get(id)?.last_seen && new Date(statusById.get(id).last_seen).getTime() >= Date.now() - 3 * 60 * 1000,
        },
        like_kind: latestLikeByUser.get(id)?.kind ?? "like",
        liked_at: latestLikeByUser.get(id)?.created_at ?? null,
      }));

      return json({ ok: true, vybe_plus_until: plusRows[0].vybe_plus_until, people });
    }

    if (action === "spotlight_use") {
      try {
        const result = await rpc("use_spotlight", { p_user_id: user.id });
        return json({ ok: true, reward_type: "spotlight", ...(result ?? {}) });
      } catch (e: any) {
        const message = String(e?.message || "");
        if (message.includes("NO_SPOTLIGHT")) return json({ ok: false, error: "No Spotlight balance" }, 409);
        if (message.includes("USER_NOT_FOUND")) return json({ ok: false, error: "User not found" }, 404);
        console.error("spotlight_use:rpc_failed", { user_id: user.id, error: message.slice(0, 180) });
        return json({ ok: false, error: "Spotlight transaction failed" }, 500);
      }
    }

    if (action === "account_delete") {
      const confirmation = clean(body.confirmation, 40);
      if (confirmation !== "ВИДАЛИТИ") {
        return json({ ok: false, error: "Confirmation required" }, 400);
      }

      try {
        const result = await rpc("vybe_delete_account", { p_user_id: user.id });
        let photoCleanupOk = await cleanupProfilePhotoFolder(user.id, null);
        if (!photoCleanupOk && result?.photo_url) {
          photoCleanupOk = await deleteProfilePhotoWithRetry(result.photo_url);
        }
        if (!photoCleanupOk) {
          console.error("account_delete:photo_cleanup_pending", { user_id: user.id });
        }
        return json({
          ok: true,
          deleted: result?.deleted === true,
          already_deleted: result?.already_deleted === true,
          financial_orders_retained: Number(result?.financial_orders_retained || 0),
          photo_cleanup_ok: photoCleanupOk,
        });
      } catch (e) {
        const message = String(e instanceof Error ? e.message : e);
        if (message.includes("ADMIN_ACCOUNT_DELETE_BLOCKED") || message.includes("ADMIN_AUDIT_RETENTION")) {
          return json({ ok: false, error: "ADMIN_ACCOUNT_DELETE_BLOCKED" }, 409);
        }
        console.error("account_delete:failed", {
          user_id: user.id,
          error: message.slice(0, 180),
        });
        return json({ ok: false, error: "Account deletion failed" }, 500);
      }
    }

    if (action === "blocks_list") {
      const rows = await db(
        `blocks?blocker_id=eq.${encodeURIComponent(user.id)}&select=id,blocked_id,created_at&order=created_at.desc&limit=500`,
      ) ?? [];
      const ids = [...new Set(rows.map((x: any) => String(x.blocked_id)))];
      let profiles: any[] = [];
      if (ids.length) {
        profiles = await db(
          `profiles?user_id=in.(${ids.map((x) => encodeURIComponent(x)).join(",")})&select=user_id,name,age,city`,
        ) ?? [];
      }
      const byId = new Map(profiles.map((p: any) => [String(p.user_id), p]));
      return json({
        ok: true,
        blocked: rows.map((row: any) => ({
          block_id: row.id,
          user_id: String(row.blocked_id),
          created_at: row.created_at,
          profile: byId.get(String(row.blocked_id)) ?? null,
        })),
      });
    }

    if (action === "block_user") {
      const targetId = clean(body.target_user_id, 80);
      if (!targetId || targetId === user.id) return json({ ok: false, error: "Invalid block target" }, 400);
      const target = await db(`users?id=eq.${encodeURIComponent(targetId)}&select=id&limit=1`);
      if (!target?.[0]) return json({ ok: false, error: "User not found" }, 404);

      const block = await ensureBlock(db, user.id, targetId);
      await removePairLikes(db, user.id, targetId);
      return json({ ok: true, blocked: true, created: block.created });
    }

    if (action === "unblock_user") {
      const targetId = clean(body.target_user_id, 80);
      if (!targetId || targetId === user.id) return json({ ok: false, error: "Invalid unblock target" }, 400);
      await db(
        `blocks?blocker_id=eq.${encodeURIComponent(user.id)}&blocked_id=eq.${encodeURIComponent(targetId)}`,
        { method: "DELETE" },
      );
      return json({ ok: true, blocked: false });
    }

    if (action === "report_user") {
      const targetId = clean(body.target_user_id, 80);
      const reason = clean(body.reason, 40);
      const details = clean(body.details, 1000) || null;
      const shouldBlock = body.block === true || body.block === "true" || body.block === 1 || body.block === "1";
      const allowedReasons = new Set([
        "fake_profile",
        "spam",
        "harassment",
        "underage",
        "sexual_services",
        "illegal_content",
        "other",
      ]);

      if (!targetId || targetId === user.id) return json({ ok: false, error: "Invalid report target" }, 400);
      if (!allowedReasons.has(reason)) return json({ ok: false, error: "Invalid report reason" }, 400);

      const target = await db(`users?id=eq.${encodeURIComponent(targetId)}&select=id&limit=1`) ?? [];
      if (!target?.[0]) return json({ ok: false, error: "User not found" }, 404);

      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const [recentReports, duplicateRows] = await Promise.all([
        db(`reports?reporter_id=eq.${encodeURIComponent(user.id)}&created_at=gte.${encodeURIComponent(tenMinutesAgo)}&select=id&limit=10`) ?? [],
        db(`reports?reporter_id=eq.${encodeURIComponent(user.id)}&reported_id=eq.${encodeURIComponent(targetId)}&reason=eq.${encodeURIComponent(reason)}&created_at=gte.${encodeURIComponent(tenMinutesAgo)}&select=id,block_requested,status&order=created_at.desc&limit=1`) ?? [],
      ]);

      if ((recentReports?.length ?? 0) >= 5) {
        return json({ ok: false, error: "Too many reports. Please try again later." }, 429);
      }

      const duplicate = duplicateRows?.[0];
      if (duplicate?.id) {
        if (shouldBlock) {
          await ensureBlock(db, user.id, targetId);
          await removePairLikes(db, user.id, targetId);
          if (duplicate.block_requested !== true) {
            await db(`reports?id=eq.${encodeURIComponent(String(duplicate.id))}`, {
              method:"PATCH",
              body:JSON.stringify({ block_requested:true, updated_at:new Date().toISOString() }),
            });
          }
        }
        console.log("report:duplicate_prevented",{
          report_id:duplicate.id,
          reporter_id:user.id,
          reported_id:targetId,
          reason,
          block_requested:shouldBlock,
        });
        return json({
          ok:true,
          report_id:duplicate.id,
          blocked:shouldBlock,
          duplicate_prevented:true,
        });
      }

      const report = await db("reports", {
        method: "POST",
        body: JSON.stringify({
          reporter_id: user.id,
          reported_id: targetId,
          reason,
          details,
          status: "open",
          block_requested: shouldBlock,
          updated_at: new Date().toISOString(),
        }),
      });

      if (report?.[0]?.id) {
        await notifyModerationAdmins(db, botToken, String(report[0].id), reason);
      }

      if (shouldBlock) {
        await ensureBlock(db, user.id, targetId);
        await removePairLikes(db, user.id, targetId);
      }

      console.log("report:create", {
        report_id: report?.[0]?.id ?? null,
        reporter_id: user.id,
        reported_id: targetId,
        reason,
        block_requested: shouldBlock,
      });

      return json({
        ok: true,
        report_id: report?.[0]?.id ?? null,
        blocked: shouldBlock,
        duplicate_prevented:false,
      });
    }

    if (action === "profile_public") {
      const targetId = clean(body.target_user_id, 80);
      if (!targetId || targetId === String(user.id)) return json({ ok: false, error: "Invalid profile target" }, 400);
      if (await isBlockedBetween(db, user.id, targetId)) return json({ ok: false, error: "User blocked" }, 403);

      const [targetRows, profileRows, intentRows, matchRows] = await Promise.all([
        db(`users?id=eq.${encodeURIComponent(targetId)}&select=id,last_seen,account_status&limit=1`) ?? [],
        db(`profiles?user_id=eq.${encodeURIComponent(targetId)}&select=user_id,name,age,city,gender,looking_for,bio,photo_url,verified&limit=1`) ?? [],
        db(`intents?user_id=eq.${encodeURIComponent(targetId)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=intent,expires_at&limit=1`) ?? [],
        db(`matches?or=(and(user_a_id.eq.${encodeURIComponent(user.id)},user_b_id.eq.${encodeURIComponent(targetId)}),and(user_a_id.eq.${encodeURIComponent(targetId)},user_b_id.eq.${encodeURIComponent(user.id)}))&select=id,realtime_topic&limit=1`) ?? [],
      ]);
      const target = targetRows?.[0];
      const profile = profileRows?.[0];
      if (!target || target.account_status === "restricted" || !profile) {
        return json({ ok: false, error: "User unavailable" }, 404);
      }
      const lastSeen = target.last_seen ? new Date(target.last_seen).getTime() : 0;
      const publicPhotos = await signProfilePhotoUrls([profile.photo_url ?? null]);
      const signedProfile = withSignedProfilePhoto(profile, publicPhotos);
      return json({
        ok: true,
        user_id: targetId,
        profile: {
          ...signedProfile,
          online: !!lastSeen && lastSeen >= Date.now() - 3 * 60 * 1000,
          intent: intentRows?.[0]?.intent ?? null,
          intent_expires_at: intentRows?.[0]?.expires_at ?? null,
        },
        matched: !!matchRows?.[0],
        match_id: matchRows?.[0]?.id ?? null,
        realtime_topic: matchRows?.[0]?.realtime_topic ?? null,
      });
    }

    if (action === "set_intent") {
      const allowed = new Set(["Поговорити", "Флірт", "Вірт", "Дружба", "Голос", "Зустріч"]);
      const intent = clean(body.intent, 30);
      const hours = Number(body.hours);
      if (!allowed.has(intent) || !Number.isFinite(hours) || hours < 0.05 || hours > 24) return json({ ok: false, error: "Invalid intent duration" }, 400);
      const expiresAt = new Date(Date.now() + hours * 3600000).toISOString();
      const rows = await db(`intents?user_id=eq.${encodeURIComponent(user.id)}&select=id&limit=1`);
      const payload = { user_id: user.id, intent, expires_at: expiresAt };
      if (rows?.length) await db(`intents?user_id=eq.${encodeURIComponent(user.id)}`, { method: "PATCH", body: JSON.stringify(payload) });
      else await db("intents", { method: "POST", body: JSON.stringify(payload) });
      return json({ ok: true, intent, expires_at: expiresAt });
    }

    if (action === "pass") {
      const targetId = clean(body.target_user_id, 80);
      if (!targetId || targetId === String(user.id)) return json({ ok: false, error: "Invalid pass target" }, 400);
      if (await isRestrictedUser(db, targetId)) return json({ ok: false, error: "User unavailable" }, 403);
      if (await isBlockedBetween(db, user.id, targetId)) return json({ ok: false, error: "User blocked" }, 403);

      const nowIso = new Date().toISOString();
      const targetIntentRows = await db(
        `intents?user_id=eq.${encodeURIComponent(targetId)}&expires_at=gt.${encodeURIComponent(nowIso)}&select=expires_at&limit=1`,
      ) ?? [];
      const targetIntentExpiresAt = targetIntentRows?.[0]?.expires_at ?? null;
      if (!targetIntentExpiresAt) return json({ ok: true, recorded: false, reason: "inactive_intent" });

      const existing = await db(
        `discovery_passes?user_id=eq.${encodeURIComponent(user.id)}&target_user_id=eq.${encodeURIComponent(targetId)}&select=user_id&limit=1`,
      ) ?? [];
      const payload = {
        user_id: user.id,
        target_user_id: targetId,
        target_intent_expires_at: targetIntentExpiresAt,
        passed_at: nowIso,
      };
      if (existing.length) {
        await db(
          `discovery_passes?user_id=eq.${encodeURIComponent(user.id)}&target_user_id=eq.${encodeURIComponent(targetId)}`,
          { method: "PATCH", body: JSON.stringify(payload) },
        );
      } else {
        await db("discovery_passes", { method: "POST", body: JSON.stringify(payload) });
      }
      return json({ ok: true, recorded: true, target_intent_expires_at: targetIntentExpiresAt });
    }

    if (action === "discover") {
      const nowIso = new Date().toISOString();
      const minAgeRaw = Number(body.min_age);
      const maxAgeRaw = Number(body.max_age);
      const minAge = Number.isFinite(minAgeRaw) ? Math.max(18, Math.min(99, Math.floor(minAgeRaw))) : 18;
      const maxAge = Number.isFinite(maxAgeRaw) ? Math.max(minAge, Math.min(99, Math.floor(maxAgeRaw))) : 99;
      const city = clean(body.city, 40);
      const requestedIntent = clean(body.intent, 30);
      const allowedIntents = new Set(["Поговорити", "Флірт", "Вірт", "Дружба", "Голос", "Зустріч"]);
      const intentFilter = allowedIntents.has(requestedIntent) ? requestedIntent : "";
      const onlineOnly = body.online_only === true;
      const verifiedOnly = body.verified_only === true;

      const pageSizeRaw = Number(body.page_size);
      const pageSize = Number.isFinite(pageSizeRaw)
        ? Math.max(5, Math.min(40, Math.floor(pageSizeRaw)))
        : 100;

      const snapshotRaw = clean(body.snapshot_at, 60);
      const snapshotMs = snapshotRaw ? new Date(snapshotRaw).getTime() : NaN;
      const snapshotAccepted = Number.isFinite(snapshotMs)
        && snapshotMs <= Date.now() + 60_000
        && snapshotMs >= Date.now() - 30 * 60_000;
      let snapshotAt = snapshotAccepted ? new Date(snapshotMs).toISOString() : nowIso;

      const rawCursor = body.cursor && typeof body.cursor === "object" && !Array.isArray(body.cursor)
        ? body.cursor as Record<string, unknown>
        : null;
      let paginationReset = false;
      let afterSpotlight: number | null = null;
      let afterSpotlightUntil: string | null = null;
      let afterIntentMatch: number | null = null;
      let afterOnline: number | null = null;
      let afterVerified: number | null = null;
      let afterUserId: string | null = null;

      if (rawCursor) {
        if (!snapshotAccepted) {
          paginationReset = true;
        } else {
          const userId = clean(rawCursor.user_id, 80);
          const spotlight = Number(rawCursor.spotlight);
          const intentMatch = Number(rawCursor.intent_match);
          const online = Number(rawCursor.online);
          const verified = Number(rawCursor.verified);
          const spotlightUntilRaw = clean(rawCursor.spotlight_until, 60);
          const spotlightUntilMs = new Date(spotlightUntilRaw).getTime();
          const uuidOk = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);
          const bit = (value: number) => value === 0 || value === 1;
          if (!uuidOk || !bit(spotlight) || !bit(intentMatch) || !bit(online) || !bit(verified) || !Number.isFinite(spotlightUntilMs)) {
            return json({ ok: false, error: "Invalid discovery cursor" }, 400);
          }
          afterSpotlight = spotlight;
          afterSpotlightUntil = new Date(spotlightUntilMs).toISOString();
          afterIntentMatch = intentMatch;
          afterOnline = online;
          afterVerified = verified;
          afterUserId = userId;
        }
      }

      const rows = await rpc("vybe_discover_page", {
        p_user_id: user.id,
        p_min_age: minAge,
        p_max_age: maxAge,
        p_city: city,
        p_intent: intentFilter || null,
        p_online_only: onlineOnly,
        p_verified_only: verifiedOnly,
        p_limit: pageSize + 1,
        p_snapshot_at: snapshotAt,
        p_after_spotlight: afterSpotlight,
        p_after_spotlight_until: afterSpotlightUntil,
        p_after_intent_match: afterIntentMatch,
        p_after_online: afterOnline,
        p_after_verified: afterVerified,
        p_after_user_id: afterUserId,
      }) ?? [];

      const hasMore = rows.length > pageSize;
      const pageRows = rows.slice(0, pageSize);
      const last = pageRows.length ? pageRows[pageRows.length - 1] : null;
      const nextCursor = hasMore && last ? {
        spotlight: Number(last.rank_spotlight || 0),
        spotlight_until: last.rank_spotlight_until,
        intent_match: Number(last.rank_intent_match || 0),
        online: Number(last.rank_online || 0),
        verified: Number(last.rank_verified || 0),
        user_id: last.rank_user_id,
      } : null;

      const discoveryPhotos = await signProfilePhotoUrls(pageRows.map((row: any) => row.photo_url ?? null));
      const people = pageRows.map((row: any) => ({
        user_id: row.user_id,
        name: row.name,
        age: row.age,
        city: row.city,
        bio: row.bio,
        photo_url: row.photo_url ? (discoveryPhotos.get(String(row.photo_url)) ?? null) : null,
        verified: row.verified === true,
        online: row.online === true,
        intent: row.intent,
        intent_match: row.intent_match === true,
        expires_at: row.expires_at ?? null,
        spotlight_until: row.spotlight_until ?? null,
        spotlight_active: row.spotlight_active === true,
        already_matched: false,
      }));

      return json({
        ok: true,
        filters: {
          min_age: minAge,
          max_age: maxAge,
          city,
          intent: intentFilter || null,
          online_only: onlineOnly,
          verified_only: verifiedOnly,
        },
        people,
        pagination: {
          page_size: pageSize,
          has_more: hasMore,
          next_cursor: nextCursor,
          snapshot_at: snapshotAt,
          reset: paginationReset,
        },
      });
    }

    if (action === "super_like") {
      const targetId = clean(body.target_user_id, 80);
      if (!targetId || targetId === String(user.id)) return json({ ok: false, error: "Invalid like target" }, 400);

      try {
        const result = await rpc("vybe_like_and_match", {
          p_user_id: user.id,
          p_target_user_id: targetId,
          p_kind: "super",
        });

        const matchId = result?.match?.id ? String(result.match.id) : null;
        if (result?.matched === true && result?.match_created === true && matchId) {
          await Promise.all([
            sendSocialNotification(db,botToken,{
              eventType:"match",
              recipientUserId:String(user.id),
              actorUserId:targetId,
              matchId,
              sourceKey:`match:${matchId}:${user.id}`,
            }),
            sendSocialNotification(db,botToken,{
              eventType:"match",
              recipientUserId:targetId,
              actorUserId:String(user.id),
              matchId,
              sourceKey:`match:${matchId}:${targetId}`,
            }),
          ]);
        } else if (result?.matched !== true && result?.super_charged === true) {
          await sendSocialNotification(db,botToken,{
            eventType:"like",
            recipientUserId:targetId,
            actorUserId:String(user.id),
            sourceKey:`super_like:${user.id}:${targetId}`,
            variant:"super",
          });
        }

        return json({ ok: true, ...(result ?? {}) });
      } catch (e: any) {
        const message = String(e?.message || "");
        if (message.includes("NO_SUPERVYBE")) return json({ ok: false, error: "No SuperVYBE balance" }, 409);
        if (message.includes("TARGET_NOT_FOUND")) return json({ ok: false, error: "User not found" }, 404);
        if (message.includes("INVALID_TARGET")) return json({ ok: false, error: "Invalid like target" }, 400);
        if (message.includes("USER_BLOCKED")) return json({ ok: false, error: "User blocked" }, 403);
        if (message.includes("USER_UNAVAILABLE")) return json({ ok: false, error: "Account unavailable" }, 403);
        console.error("super_like:rpc_failed", { user_id: user.id, target_id: targetId, error: message.slice(0, 180) });
        return json({ ok: false, error: "SuperVYBE transaction failed" }, 500);
      }
    }

    if (action === "like") {
      const targetId = clean(body.target_user_id, 80);
      if (!targetId || targetId === String(user.id)) return json({ ok: false, error: "Invalid like target" }, 400);

      try {
        const result = await rpc("vybe_like_and_match", {
          p_user_id: user.id,
          p_target_user_id: targetId,
          p_kind: "like",
        });

        const matchId = result?.match?.id ? String(result.match.id) : null;
        if (result?.matched === true && result?.match_created === true && matchId) {
          await Promise.all([
            sendSocialNotification(db,botToken,{
              eventType:"match",
              recipientUserId:String(user.id),
              actorUserId:targetId,
              matchId,
              sourceKey:`match:${matchId}:${user.id}`,
            }),
            sendSocialNotification(db,botToken,{
              eventType:"match",
              recipientUserId:targetId,
              actorUserId:String(user.id),
              matchId,
              sourceKey:`match:${matchId}:${targetId}`,
            }),
          ]);
        } else if (result?.matched !== true && result?.like_created === true) {
          await sendSocialNotification(db,botToken,{
            eventType:"like",
            recipientUserId:targetId,
            actorUserId:String(user.id),
            sourceKey:`like:${user.id}:${targetId}`,
            variant:"like",
          });
        }

        return json({ ok: true, ...(result ?? {}) });
      } catch (e: any) {
        const message = String(e?.message || "");
        if (message.includes("TARGET_NOT_FOUND")) return json({ ok: false, error: "User not found" }, 404);
        if (message.includes("INVALID_TARGET")) return json({ ok: false, error: "Invalid like target" }, 400);
        if (message.includes("USER_BLOCKED")) return json({ ok: false, error: "User blocked" }, 403);
        if (message.includes("USER_UNAVAILABLE")) return json({ ok: false, error: "Account unavailable" }, 403);
        console.error("like:rpc_failed", { user_id: user.id, target_id: targetId, error: message.slice(0, 180) });
        return json({ ok: false, error: "VYBE transaction failed" }, 500);
      }
    }

    if (action === "matches") {
      const enriched = await rpc("vybe_matches_for_user", { p_user_id: user.id }) ?? [];
      const matchPhotos = await signProfilePhotoUrls(
        (enriched ?? []).map((m: any) => m?.profile?.photo_url ?? null),
      );
      const signedMatches = (enriched ?? []).map((m: any) => ({
        ...m,
        profile: m?.profile
          ? {
              ...m.profile,
              photo_url: m.profile.photo_url
                ? (matchPhotos.get(String(m.profile.photo_url)) ?? null)
                : null,
            }
          : m?.profile ?? null,
      }));
      return json({
        ok: true,
        matches: signedMatches,
        unread_total: signedMatches.reduce((n: number, m: any) => n + Number(m.unread_count || 0), 0),
      });
    }

    if (action === "messages_list") {
      const matchId = clean(body.match_id, 80);
      const owned = await getMatchOtherUser(db, matchId, user.id);
      if (!owned) return json({ ok: false, error: "Match not found" }, 404);
      if (await isRestrictedUser(db,owned.id)) return json({ok:false,error:"User unavailable"},403);
      if (await isBlockedBetween(db, user.id, owned.id)) return json({ ok: false, error: "User blocked" }, 403);

      const newestMessages = await db(`messages?match_id=eq.${encodeURIComponent(matchId)}&select=id,match_id,sender_id,body,created_at&order=created_at.desc&limit=200`) ?? [];
      const messages = [...newestMessages].reverse();
      const [myReads, peerReads] = await Promise.all([
        db(`match_reads?user_id=eq.${encodeURIComponent(user.id)}&match_id=eq.${encodeURIComponent(matchId)}&select=last_read_at&limit=1`),
        db(`match_reads?user_id=eq.${encodeURIComponent(owned.id)}&match_id=eq.${encodeURIComponent(matchId)}&select=last_read_at&limit=1`),
      ]);

      const myLastRead = myReads?.[0]?.last_read_at ?? null;
      const latestPeerMessage = [...messages].reverse().find((m: any) => String(m.sender_id) !== String(user.id));
      const latestPeerAt = latestPeerMessage?.created_at ?? null;

      if (latestPeerAt && (!myLastRead || new Date(latestPeerAt).getTime() > new Date(myLastRead).getTime())) {
        if (myReads?.length) {
          await db(
            `match_reads?user_id=eq.${encodeURIComponent(user.id)}&match_id=eq.${encodeURIComponent(matchId)}`,
            { method: "PATCH", body: JSON.stringify({ last_read_at: latestPeerAt }) },
          );
        } else {
          await db("match_reads", {
            method: "POST",
            body: JSON.stringify({ user_id: user.id, match_id: matchId, last_read_at: latestPeerAt }),
          });
        }
      }

      return json({
        ok: true,
        messages,
        has_older: newestMessages.length >= 200,
        peer_last_read_at: peerReads?.[0]?.last_read_at ?? null,
      });
    }

    if (action === "message_send") {
      const matchId = clean(body.match_id, 80);
      const message = clean(body.message, 2000);
      if (!message) return json({ ok: false, error: "Message is empty" }, 400);
      const owned = await getMatchOtherUser(db, matchId, user.id);
      if (!owned) return json({ ok: false, error: "Match not found" }, 404);
      if (await isRestrictedUser(db,owned.id)) return json({ok:false,error:"User unavailable"},403);
      if (await isBlockedBetween(db, user.id, owned.id)) return json({ ok: false, error: "User blocked" }, 403);
      const created = await db("messages", { method: "POST", body: JSON.stringify({ match_id: matchId, sender_id: user.id, body: message }) });

      await sendSocialNotification(db,botToken,{
        eventType:"message",
        recipientUserId:owned.id,
        actorUserId:String(user.id),
        matchId,
        sourceKey:created?.[0]?.id ? `message:${created[0].id}` : null,
      });

      return json({ ok: true, message: created?.[0] ?? null });
    }

    return json({ ok: false, error: "Unknown action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("telegram-auth:", message);
    const authError = message.startsWith("Telegram") || message.startsWith("Invalid Telegram");
    return json({ ok: false, authenticated: false, error: authError ? message : "Server request failed" }, authError ? 401 : 500);
  }
});
