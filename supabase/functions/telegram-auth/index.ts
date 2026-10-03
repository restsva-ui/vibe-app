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
  const payload: Record<string, unknown> = {
    url: `${baseUrl}/functions/v1/telegram-bot`,
    allowed_updates: ["message", "pre_checkout_query"],
    drop_pending_updates: false,
  };
  if (secret) payload.secret_token = secret;
  await telegramApi(botToken, "setWebhook", payload);
}

async function ensureUser(db: ReturnType<typeof dbClient>, tgUser: any) {
  const telegramId = String(tgUser.id);
  const rows = await db(`users?telegram_id=eq.${encodeURIComponent(telegramId)}&select=id,telegram_id,realtime_topic,last_seen&limit=1`);
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

async function uploadProfilePhoto(userId: string, bytes: Uint8Array, mime: string) {
  const url = Deno.env.get("SUPABASE_URL");
  if (!url) throw new Error("Storage configuration missing");
  const ext = mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : "webp";
  const objectPath = `${userId}/${crypto.randomUUID()}.${ext}`;
  const response = await storageRequest(
    `object/${PROFILE_BUCKET}/${encodeStoragePath(objectPath)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": mime,
        "Cache-Control": "3600",
        "x-upsert": "false",
      },
      body: bytes,
    },
  );
  const text = await response.text();
  if (!response.ok) throw new Error(`Storage upload error ${response.status}: ${text.slice(0, 240)}`);
  const publicUrl = `${url}/storage/v1/object/public/${PROFILE_BUCKET}/${encodeStoragePath(objectPath)}`;
  return { objectPath, publicUrl };
}

async function deleteProfilePhotoByUrl(photoUrl: string | null | undefined) {
  if (!photoUrl) return;
  const marker = `/storage/v1/object/public/${PROFILE_BUCKET}/`;
  const idx = photoUrl.indexOf(marker);
  if (idx < 0) return;
  const encoded = photoUrl.slice(idx + marker.length);
  let objectPath = encoded;
  try {
    objectPath = encoded.split("/").map((part) => decodeURIComponent(part)).join("/");
  } catch {}
  const response = await storageRequest(
    `object/${PROFILE_BUCKET}/${encodeStoragePath(objectPath)}`,
    { method: "DELETE" },
  );
  if (!response.ok && response.status !== 404) {
    console.warn("profile_photo:delete_failed", { status: response.status });
  }
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

    if (action === "profile_get") {
      return json({
        ok: true,
        user_id: user.id,
        realtime_topic: user.realtime_topic ?? null,
        profile: await getProfile(db, user.id),
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
      if (!detected || detected !== declaredMime) return json({ ok: false, error: "Unsupported image" }, 400);

      const uploaded = await uploadProfilePhoto(user.id, bytes, detected);
      await db(`profiles?user_id=eq.${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ photo_url: uploaded.publicUrl, updated_at: new Date().toISOString() }),
      });
      await deleteProfilePhotoByUrl(profile.photo_url);

      return json({ ok: true, photo_url: uploaded.publicUrl });
    }

    if (action === "photo_remove") {
      const profile = await getProfile(db, user.id);
      if (!profile) return json({ ok: false, error: "Profile not found" }, 404);
      await db(`profiles?user_id=eq.${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ photo_url: null, updated_at: new Date().toISOString() }),
      });
      await deleteProfilePhotoByUrl(profile.photo_url);
      return json({ ok: true, photo_url: null });
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
        db(`users?id=in.(${senderIds.map((x) => encodeURIComponent(x)).join(",")})&select=id,last_seen`) ?? [],
      ]);
      const profileById = new Map(profiles.map((p: any) => [String(p.user_id), p]));
      const statusById = new Map(statuses.map((x: any) => [String(x.id), x.last_seen]));
      const latestLikeByUser = new Map<string, any>();
      for (const like of likes ?? []) {
        const id = String(like.from_user_id);
        if (!senderIds.includes(id) || latestLikeByUser.has(id)) continue;
        latestLikeByUser.set(id, like);
      }

      const people = senderIds.map((id) => ({
        user_id: id,
        profile: {
          ...(profileById.get(id) ?? {}),
          online: !!statusById.get(id) && new Date(statusById.get(id)).getTime() >= Date.now() - 3 * 60 * 1000,
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

      const profile = await getProfile(db, user.id);
      try {
        await deleteProfilePhotoByUrl(profile?.photo_url);
      } catch (e) {
        console.warn("account_delete:photo_cleanup_failed", { user_id: user.id });
      }

      await db(`users?id=eq.${encodeURIComponent(user.id)}`, { method: "DELETE" });
      return json({ ok: true, deleted: true });
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
      const shouldBlock = body.block === true;
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
      const target = await db(`users?id=eq.${encodeURIComponent(targetId)}&select=id&limit=1`);
      if (!target?.[0]) return json({ ok: false, error: "User not found" }, 404);

      const report = await db("reports", {
        method: "POST",
        body: JSON.stringify({
          reporter_id: user.id,
          reported_id: targetId,
          reason,
          details,
          status: "open",
        }),
      });

      if (shouldBlock) {
        await ensureBlock(db, user.id, targetId);
        await removePairLikes(db, user.id, targetId);
      }

      return json({
        ok: true,
        report_id: report?.[0]?.id ?? null,
        blocked: shouldBlock,
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

    if (action === "discover") {
      const nowIso = new Date().toISOString();
      const minAgeRaw = Number(body.min_age);
      const maxAgeRaw = Number(body.max_age);
      const minAge = Number.isFinite(minAgeRaw) ? Math.max(18, Math.min(99, Math.floor(minAgeRaw))) : 18;
      const maxAge = Number.isFinite(maxAgeRaw) ? Math.max(minAge, Math.min(99, Math.floor(maxAgeRaw))) : 99;
      const cityFilter = clean(body.city, 40).toLocaleLowerCase("uk-UA");
      const onlineOnly = body.online_only === true;
      const verifiedOnly = body.verified_only === true;
      const onlineCutoff = Date.now() - 3 * 60 * 1000;

      const profiles = await db(`profiles?user_id=neq.${encodeURIComponent(user.id)}&select=user_id,name,age,city,bio,photo_url,verified&limit=100`) ?? [];
      const intents = await db(`intents?expires_at=gt.${encodeURIComponent(nowIso)}&select=user_id,intent,expires_at&limit=200`) ?? [];
      const spotlightRows = await db(`user_entitlements?spotlight_until=gt.${encodeURIComponent(nowIso)}&select=user_id,spotlight_until&limit=200`) ?? [];
      const [blockedIds, sentLikes, currentMatches, ownIntentRows] = await Promise.all([
        getBlockedUserIds(db, user.id),
        db(`likes?from_user_id=eq.${encodeURIComponent(user.id)}&select=to_user_id&limit=1000`) ?? [],
        db(`matches?or=(user_a_id.eq.${encodeURIComponent(user.id)},user_b_id.eq.${encodeURIComponent(user.id)})&select=user_a_id,user_b_id&limit=1000`) ?? [],
        db(`intents?user_id=eq.${encodeURIComponent(user.id)}&expires_at=gt.${encodeURIComponent(nowIso)}&select=intent&limit=1`) ?? [],
      ]);
      const sentLikeIds = new Set((sentLikes ?? []).map((x: any) => String(x.to_user_id)));
      const matchedIds = new Set((currentMatches ?? []).map((m: any) =>
        String(m.user_a_id) === String(user.id) ? String(m.user_b_id) : String(m.user_a_id)
      ));
      const ownIntent = ownIntentRows?.[0]?.intent ?? null;
      const profileIds = profiles.map((p: any) => String(p.user_id));
      const statuses = profileIds.length
        ? await db(`users?id=in.(${profileIds.map((x) => encodeURIComponent(x)).join(",")})&select=id,last_seen`) ?? []
        : [];
      const statusByUser = new Map(statuses.map((x: any) => [String(x.id), x.last_seen]));
      const byUser = new Map(intents.map((x: any) => [String(x.user_id), x]));
      const spotlightByUser = new Map(spotlightRows.map((x: any) => [String(x.user_id), x.spotlight_until]));

      const people = profiles
        .filter((p: any) => {
          const id = String(p.user_id);
          if (blockedIds.has(id) || sentLikeIds.has(id) || matchedIds.has(id)) return false;
          const age = Number(p.age || 0);
          if (age < minAge || age > maxAge) return false;
          if (cityFilter && !String(p.city || "").toLocaleLowerCase("uk-UA").includes(cityFilter)) return false;
          if (verifiedOnly && p.verified !== true) return false;
          const lastSeen = statusByUser.get(id);
          const online = !!lastSeen && new Date(lastSeen).getTime() >= onlineCutoff;
          if (onlineOnly && !online) return false;
          return true;
        })
        .map((p: any) => {
          const id = String(p.user_id);
          const lastSeen = statusByUser.get(id) ?? null;
          const online = !!lastSeen && new Date(lastSeen).getTime() >= onlineCutoff;
          return {
            user_id: p.user_id,
            name: p.name,
            age: p.age,
            city: p.city,
            bio: p.bio,
            photo_url: p.photo_url ?? null,
            verified: p.verified === true,
            online,
            intent: byUser.get(id)?.intent ?? "Поговорити",
            intent_match: !!ownIntent && byUser.get(id)?.intent === ownIntent,
            expires_at: byUser.get(id)?.expires_at ?? null,
            spotlight_until: spotlightByUser.get(id) ?? null,
            spotlight_active: spotlightByUser.has(id),
          };
        })
        .sort((a: any, b: any) => {
          const aSpot = a.spotlight_active ? 1 : 0;
          const bSpot = b.spotlight_active ? 1 : 0;
          if (aSpot !== bSpot) return bSpot - aSpot;
          if (aSpot && bSpot) {
            const diff = new Date(b.spotlight_until).getTime() - new Date(a.spotlight_until).getTime();
            if (diff) return diff;
          }
          if (a.intent_match !== b.intent_match) return Number(b.intent_match) - Number(a.intent_match);
          if (a.online !== b.online) return Number(b.online) - Number(a.online);
          if (a.verified !== b.verified) return Number(b.verified) - Number(a.verified);
          return 0;
        });

      return json({
        ok: true,
        filters: { min_age: minAge, max_age: maxAge, city: clean(body.city, 40), online_only: onlineOnly, verified_only: verifiedOnly },
        people,
      });
    }


    if (action === "super_like") {
      const targetId = clean(body.target_user_id, 80);
      if (!targetId || targetId === user.id) return json({ ok: false, error: "Invalid like target" }, 400);
      if (await isBlockedBetween(db, user.id, targetId)) return json({ ok: false, error: "User blocked" }, 403);
      try {
        const result = await rpc("use_supervybe_and_like", {
          p_user_id: user.id,
          p_target_user_id: targetId,
        });
        return json({ ok: true, ...(result ?? {}) });
      } catch (e: any) {
        const message = String(e?.message || "");
        if (message.includes("NO_SUPERVYBE")) return json({ ok: false, error: "No SuperVYBE balance" }, 409);
        if (message.includes("TARGET_NOT_FOUND")) return json({ ok: false, error: "User not found" }, 404);
        if (message.includes("INVALID_TARGET")) return json({ ok: false, error: "Invalid like target" }, 400);
        if (message.includes("USER_BLOCKED")) return json({ ok: false, error: "User blocked" }, 403);
        console.error("super_like:rpc_failed", { user_id: user.id, target_id: targetId, error: message.slice(0, 180) });
        return json({ ok: false, error: "SuperVYBE transaction failed" }, 500);
      }
    }

    if (action === "like") {
      const targetId = clean(body.target_user_id, 80);
      const kind = body.kind === "super" ? "super" : "like";
      if (!targetId || targetId === user.id) return json({ ok: false, error: "Invalid like target" }, 400);
      const target = await db(`users?id=eq.${encodeURIComponent(targetId)}&select=id&limit=1`);
      if (!target?.[0]) return json({ ok: false, error: "User not found" }, 404);
      if (await isBlockedBetween(db, user.id, targetId)) return json({ ok: false, error: "User blocked" }, 403);

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
      const allRows = await db(`matches?or=(user_a_id.eq.${encodeURIComponent(user.id)},user_b_id.eq.${encodeURIComponent(user.id)})&select=id,user_a_id,user_b_id,realtime_topic,created_at&order=created_at.desc&limit=100`) ?? [];
      const blockedIds = await getBlockedUserIds(db, user.id);
      const rows = allRows.filter((m: any) => {
        const otherId = String(m.user_a_id) === String(user.id) ? String(m.user_b_id) : String(m.user_a_id);
        return !blockedIds.has(otherId);
      });
      const otherIds = [...new Set(rows.map((m: any) => String(m.user_a_id) === String(user.id) ? String(m.user_b_id) : String(m.user_a_id)))];
      let profiles: any[] = [];
      if (otherIds.length) profiles = await db(`profiles?user_id=in.(${otherIds.map((x) => encodeURIComponent(x)).join(",")})&select=user_id,name,age,city,bio,photo_url,verified`) ?? [];
      const statuses = otherIds.length
        ? await db(`users?id=in.(${otherIds.map((x) => encodeURIComponent(x)).join(",")})&select=id,last_seen`) ?? []
        : [];
      const statusById = new Map(statuses.map((x: any) => [String(x.id), x.last_seen]));
      const byId = new Map(profiles.map((p: any) => [String(p.user_id), p]));
      const enriched = await Promise.all(rows.map(async (m: any) => {
        const otherId = String(m.user_a_id) === String(user.id) ? String(m.user_b_id) : String(m.user_a_id);
        const reads = await db(`match_reads?user_id=eq.${encodeURIComponent(user.id)}&match_id=eq.${encodeURIComponent(m.id)}&select=last_read_at&limit=1`) ?? [];
        const lastRead = reads?.[0]?.last_read_at ?? "1970-01-01T00:00:00.000Z";
        const unread = await db(`messages?match_id=eq.${encodeURIComponent(m.id)}&sender_id=neq.${encodeURIComponent(user.id)}&created_at=gt.${encodeURIComponent(lastRead)}&select=id`) ?? [];
        const latest = await db(`messages?match_id=eq.${encodeURIComponent(m.id)}&select=body,created_at&order=created_at.desc&limit=1`) ?? [];
        return {
          match_id: m.id,
          realtime_topic: m.realtime_topic,
          created_at: m.created_at,
          user_id: otherId,
          profile: {
            ...(byId.get(otherId) ?? {}),
            online: !!statusById.get(otherId) && new Date(statusById.get(otherId)).getTime() >= Date.now() - 3 * 60 * 1000,
          },
          unread_count: unread.length,
          last_message: latest?.[0]?.body ?? "",
          last_message_at: latest?.[0]?.created_at ?? null,
        };
      }));
      return json({ ok:true, matches:enriched, unread_total:enriched.reduce((n:any,m:any)=>n+Number(m.unread_count||0),0) });
    }

    if (action === "messages_list") {
      const matchId = clean(body.match_id, 80);
      const owned = await getMatchOtherUser(db, matchId, user.id);
      if (!owned) return json({ ok: false, error: "Match not found" }, 404);
      if (await isBlockedBetween(db, user.id, owned.id)) return json({ ok: false, error: "User blocked" }, 403);

      const messages = await db(`messages?match_id=eq.${encodeURIComponent(matchId)}&select=id,match_id,sender_id,body,created_at&order=created_at.asc&limit=200`) ?? [];
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
        peer_last_read_at: peerReads?.[0]?.last_read_at ?? null,
      });
    }

    if (action === "message_send") {
      const matchId = clean(body.match_id, 80);
      const message = clean(body.message, 2000);
      if (!message) return json({ ok: false, error: "Message is empty" }, 400);
      const owned = await getMatchOtherUser(db, matchId, user.id);
      if (!owned) return json({ ok: false, error: "Match not found" }, 404);
      if (await isBlockedBetween(db, user.id, owned.id)) return json({ ok: false, error: "User blocked" }, 403);
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
