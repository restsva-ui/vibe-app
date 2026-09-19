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

async function ensureUser(db: ReturnType<typeof dbClient>, tgUser: any) {
  const telegramId = String(tgUser.id);
  const rows = await db(`users?telegram_id=eq.${encodeURIComponent(telegramId)}&select=id,telegram_id&limit=1`);
  if (rows?.[0]) return rows[0];

  const created = await db("users", {
    method: "POST",
    body: JSON.stringify({
      telegram_id: Number(telegramId),
      username: tgUser.username ?? null,
      first_name: tgUser.first_name ?? null,
    }),
  });
  if (!created?.[0]) throw new Error("Could not create user");
  return created[0];
}

async function getProfile(db: ReturnType<typeof dbClient>, userId: string) {
  const rows = await db(`profiles?user_id=eq.${encodeURIComponent(userId)}&select=user_id,name,age,city,gender,looking_for,bio&limit=1`);
  return rows?.[0] ?? null;
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

    if (action === "profile_get") {
      return json({ ok: true, user_id: user.id, profile: await getProfile(db, user.id) });
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
      return json({ ok: true, user_id: user.id, profile: rows?.[0] ?? payload });
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

    if (action === "discover") {
      const profiles = await db(`profiles?user_id=neq.${encodeURIComponent(user.id)}&select=user_id,name,age,city,bio&limit=50`) ?? [];
      const intents = await db(`intents?expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=user_id,intent,expires_at&limit=100`) ?? [];
      const byUser = new Map(intents.map((x: any) => [String(x.user_id), x]));
      const people = profiles.map((p: any) => ({
        user_id: p.user_id,
        name: p.name,
        age: p.age,
        city: p.city,
        bio: p.bio,
        intent: byUser.get(String(p.user_id))?.intent ?? "Поговорити",
        expires_at: byUser.get(String(p.user_id))?.expires_at ?? null,
      }));
      return json({ ok: true, people });
    }


    if (action === "like") {
      const targetId = clean(body.target_user_id, 80);
      const kind = body.kind === "super" ? "super" : "like";
      if (!targetId || targetId === user.id) return json({ ok: false, error: "Invalid like target" }, 400);
      const target = await db(`users?id=eq.${encodeURIComponent(targetId)}&select=id&limit=1`);
      if (!target?.[0]) return json({ ok: false, error: "User not found" }, 404);

      const existing = await db(`likes?from_user_id=eq.${encodeURIComponent(user.id)}&to_user_id=eq.${encodeURIComponent(targetId)}&select=id&limit=1`);
      if (existing?.length) {
        await db(`likes?id=eq.${encodeURIComponent(existing[0].id)}`, { method: "PATCH", body: JSON.stringify({ kind }) });
      } else {
        await db("likes", { method: "POST", body: JSON.stringify({ from_user_id: user.id, to_user_id: targetId, kind }) });
      }

      const reciprocal = await db(`likes?from_user_id=eq.${encodeURIComponent(targetId)}&to_user_id=eq.${encodeURIComponent(user.id)}&select=id&limit=1`);
      if (!reciprocal?.length) return json({ ok: true, matched: false });

      const [userA, userB] = [String(user.id), String(targetId)].sort();
      let matchRows = await db(`matches?user_a_id=eq.${encodeURIComponent(userA)}&user_b_id=eq.${encodeURIComponent(userB)}&select=id,user_a_id,user_b_id,created_at&limit=1`);
      if (!matchRows?.length) {
        matchRows = await db("matches", { method: "POST", body: JSON.stringify({ user_a_id: userA, user_b_id: userB }) });
      }
      return json({ ok: true, matched: true, match: matchRows?.[0] ?? null });
    }

    if (action === "matches") {
      const rows = await db(`matches?or=(user_a_id.eq.${encodeURIComponent(user.id)},user_b_id.eq.${encodeURIComponent(user.id)})&select=id,user_a_id,user_b_id,created_at&order=created_at.desc&limit=100`) ?? [];
      const otherIds = [...new Set(rows.map((m: any) => String(m.user_a_id) === String(user.id) ? String(m.user_b_id) : String(m.user_a_id)))];
      let profiles: any[] = [];
      if (otherIds.length) profiles = await db(`profiles?user_id=in.(${otherIds.map((x) => encodeURIComponent(x)).join(",")})&select=user_id,name,age,city,bio`) ?? [];
      const byId = new Map(profiles.map((p: any) => [String(p.user_id), p]));
      return json({ ok: true, matches: rows.map((m: any) => {
        const otherId = String(m.user_a_id) === String(user.id) ? String(m.user_b_id) : String(m.user_a_id);
        return { match_id: m.id, created_at: m.created_at, user_id: otherId, profile: byId.get(otherId) ?? null };
      }) });
    }

    if (action === "messages_list") {
      const matchId = clean(body.match_id, 80);
      const owned = await db(`matches?id=eq.${encodeURIComponent(matchId)}&or=(user_a_id.eq.${encodeURIComponent(user.id)},user_b_id.eq.${encodeURIComponent(user.id)})&select=id&limit=1`);
      if (!owned?.length) return json({ ok: false, error: "Match not found" }, 404);
      const messages = await db(`messages?match_id=eq.${encodeURIComponent(matchId)}&select=id,match_id,sender_id,body,created_at&order=created_at.asc&limit=200`) ?? [];
      return json({ ok: true, messages });
    }

    if (action === "message_send") {
      const matchId = clean(body.match_id, 80);
      const message = clean(body.message, 2000);
      if (!message) return json({ ok: false, error: "Message is empty" }, 400);
      const owned = await db(`matches?id=eq.${encodeURIComponent(matchId)}&or=(user_a_id.eq.${encodeURIComponent(user.id)},user_b_id.eq.${encodeURIComponent(user.id)})&select=id&limit=1`);
      if (!owned?.length) return json({ ok: false, error: "Match not found" }, 404);
      const created = await db("messages", { method: "POST", body: JSON.stringify({ match_id: matchId, sender_id: user.id, body: message }) });
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
