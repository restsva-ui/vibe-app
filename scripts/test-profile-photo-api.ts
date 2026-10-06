import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

// Exercise the real handler with isolated database/storage requests and a signed fixture identity.
const originalFetch = globalThis.fetch, originalDeno = (globalThis as any).Deno;
const userId = "11111111-1111-4111-8111-111111111111", peerId = "33333333-3333-4333-8333-333333333333";
const oldPhoto = `${userId}/22222222-2222-4222-8222-222222222222.jpg`;
const botToken = "profile-photo-fixture-token";
let handler: (request: Request) => Promise<Response>;
let existing: Record<string, any> | null = null;
let failUpload = false, failSign = false, failWrite = false, failDelete = false, restricted = false, photoLimited = false;
const objects = new Set<string>(), writes: any[] = [], uploads: string[] = [], deletes: string[] = [], limits: any[] = [];
const events: string[] = [];
let checks = 0, requests = 0;

(globalThis as any).Deno = { env: { get: (key: string) => ({ TELEGRAM_BOT_TOKEN: botToken, SUPABASE_URL: "https://photo-fixture.invalid", SUPABASE_SERVICE_ROLE_KEY: "photo-fixture-service-key" } as Record<string, string>)[key] }, serve: (fn: typeof handler) => { handler = fn; } };
globalThis.fetch = async (input: any, init: RequestInit = {}) => {
  requests++;
  const url = new URL(String(input)), method = init.method || "GET";
  assert.equal(url.origin, "https://photo-fixture.invalid", "never use live accounts or storage in these tests");
  const body = typeof init.body === "string" ? JSON.parse(init.body) : null;
  if (url.pathname === "/rest/v1/users") return Response.json([{ id: userId, telegram_id: 123456, last_seen: new Date().toISOString(), account_status: restricted ? "restricted" : "active" }]);
  if (url.pathname === "/rest/v1/rpc/vybe_take_rate_limit") {
    limits.push(body);
    return Response.json({ allowed: !(photoLimited && body.p_bucket_key === "photo_upload"), retry_after_seconds: 10 });
  }
  if (url.pathname === "/rest/v1/rpc/vybe_profile_photo_objects") return Response.json([...objects].filter(x => x.startsWith(userId + "/")));
  if (url.pathname === "/rest/v1/profiles") {
    if (method === "GET") return Response.json(existing ? [existing] : []);
    assert.ok(method === "POST" || method === "PATCH");
    events.push("profile-write");writes.push({ method, body });
    if (failWrite) return Response.json({ message: "Fixture write failed" }, { status: 500 });
    existing = { ...existing, ...body };
    return Response.json([existing]);
  }
  if (url.pathname === "/rest/v1/referrals") return Response.json([]);
  if (url.pathname === "/storage/v1/object/sign/profile-photos") {
    events.push("sign");
    if (failSign) return Response.json({ message: "Fixture signing failed" }, { status: 503 });
    return Response.json(body.paths.map((path: string) => ({ path, signedURL: `/object/sign/profile-photos/${path}?token=fixture-only` })));
  }
  const prefix = "/storage/v1/object/profile-photos/";
  if (url.pathname.startsWith(prefix)) {
    const path = decodeURIComponent(url.pathname.slice(prefix.length));
    assert.ok(path.startsWith(userId + "/"), "storage writes/deletes must stay in the authenticated user's folder");
    if (method === "POST") {
      events.push("upload");uploads.push(path);
      assert.ok(["image/jpeg", "image/webp"].includes(new Headers(init.headers).get("Content-Type") || ""));
      if (failUpload) return Response.json({ message: "Fixture upload failed" }, { status: 503 });
      objects.add(path);return Response.json({ Key: path });
    }
    assert.equal(method, "DELETE");events.push("delete");deletes.push(path);
    if (failDelete) throw new Error("Fixture cleanup network error");
    objects.delete(path);return Response.json({});
  }
  throw new Error("Unexpected fixture request: " + url.pathname);
};

const fields = { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id: 123456, first_name: "Test" }) };
const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
const hash = createHmac("sha256", secret).update(Object.entries(fields).map(([k, v]) => `${k}=${v}`).sort().join("\n")).digest("hex");
const initData = new URLSearchParams({ ...fields, hash }).toString();
// JPEG header fixture covers MIME, 900×900 normalization and forbidden metadata checks.
const jpeg = Buffer.from([0xff,0xd8,0xff,0xc0,0,11,8,3,0x84,3,0x84,1,1,0x11,0,0xff,0xda,0,8,1,1,0,0,0x3f,0,0,0xff,0xd9]);
const photo = { mime_type: "image/jpeg", image_base64: jpeg.toString("base64") };
const profile = { name: "Test", age: 28, bio: "Люблю каву й гори ☕" };
const request = (extra: any = {}) => new Request("https://handler-fixture.invalid/telegram-auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save_profile", initData, profile, ...extra }) });
function reset(row: Record<string, any> | null = null) {
  existing = row ? structuredClone(row) : null;
  failUpload = failSign = failWrite = failDelete = restricted = photoLimited = false;
  writes.length = uploads.length = deletes.length = limits.length = events.length = 0;objects.clear();
  if (row?.photo_url) objects.add(row.photo_url);
}
async function check(name: string, run: () => Promise<void>) { await run();checks++;console.log("PASS:", name); }

try {
  await import("../supabase/functions/telegram-auth/index.ts");
  for (const forged of [undefined, "", "https://external.invalid/photo.jpg", `${peerId}/22222222-2222-4222-8222-222222222222.jpg`]) {
    await check("new profile needs an uploaded photo; client URL/presence claims do not count", async () => {
      reset();const response = await handler!(request({ profile: { ...profile, photo_url: forged, photo_present: true } }));
      assert.equal(response.status, 400);assert.deepEqual(await response.json(), { ok: false, error: "PHOTO_REQUIRED", field: "photo" });
      assert.equal(existing, null);assert.equal(writes.length + uploads.length, 0);
    });
  }
  await check("legacy profile without a photo cannot be saved unchanged", async () => {
    reset({ ...profile, photo_url: null });const before = structuredClone(existing);
    assert.equal((await handler!(request())).status, 400);assert.deepEqual(existing, before);assert.equal(writes.length, 0);
  });
  await check("new profile and its photo are saved together with a signed preview URL", async () => {
    reset();const response = await handler!(request({ profile_photo: photo })), body = await response.json();
    assert.equal(response.status, 200);assert.equal(body.photo_present, true);assert.match(body.photo_url, /object\/sign\/profile-photos\//);
    assert.equal(writes[0].method, "POST");assert.equal(existing?.bio, profile.bio);assert.equal(existing?.photo_url, uploads[0]);
    assert.deepEqual(events, ["upload", "sign", "profile-write"]);assert.equal(objects.size, 1);
    assert.equal(limits.find(x => x.p_bucket_key === "photo_upload")?.p_max_hits, 8);
  });
  await check("existing owned photo remains when editing other profile fields", async () => {
    reset({ ...profile, photo_url: oldPhoto, verified: true });const response = await handler!(request({ profile: { ...profile, bio: "Оновлений опис", photo_url: null } }));
    assert.equal(response.status, 200);assert.equal(existing?.photo_url, oldPhoto);assert.equal(existing?.verified, true);assert.equal(uploads.length + deletes.length, 0);
  });
  await check("normalized WebP is accepted in the registration request", async () => {
    const webp = Buffer.alloc(30);webp.write("RIFF");webp.writeUInt32LE(22,4);webp.write("WEBP",8);webp.write("VP8X",12);webp.writeUInt32LE(10,16);webp.writeUIntLE(899,24,3);webp.writeUIntLE(899,27,3);
    reset();assert.equal((await handler!(request({ profile_photo: { mime_type: "image/webp", image_base64: webp.toString("base64") } }))).status, 200);
    assert.match(existing?.photo_url, /\.webp$/);assert.equal(objects.size, 1);
  });
  await check("replacement deletes the previous photo only after the new profile write", async () => {
    reset({ ...profile, photo_url: oldPhoto });assert.equal((await handler!(request({ profile_photo: photo }))).status, 200);
    assert.equal(existing?.photo_url, uploads[0]);assert.equal(objects.has(oldPhoto), false);assert.deepEqual(deletes, [oldPhoto]);assert.ok(events.indexOf("profile-write") < events.indexOf("delete"));
  });
  await check("legacy profile can be completed with its first photo", async () => {
    reset({ ...profile, photo_url: null });assert.equal((await handler!(request({ profile_photo: photo }))).status, 200);
    assert.equal(writes[0].method, "PATCH");assert.ok(existing?.photo_url);assert.equal(objects.size, 1);
  });
  await check("upload failure preserves the original profile and photo", async () => {
    reset({ ...profile, photo_url: oldPhoto });failUpload = true;const before = structuredClone(existing), response = await handler!(request({ profile_photo: photo }));
    assert.equal(response.status, 503);assert.equal((await response.json()).error, "PHOTO_UPLOAD_FAILED");assert.deepEqual(existing, before);assert.equal(writes.length, 0);assert.equal(objects.has(oldPhoto), true);
  });
  await check("signing failure rolls back the new object before any profile is created", async () => {
    reset();failSign = true;assert.equal((await handler!(request({ profile_photo: photo }))).status, 503);
    assert.equal(existing, null);assert.equal(writes.length, 0);assert.equal(objects.size, 0);assert.deepEqual(deletes, uploads);
  });
  await check("database failure removes the new object and preserves the old photo", async () => {
    reset({ ...profile, photo_url: oldPhoto });failWrite = true;const before = structuredClone(existing);
    assert.equal((await handler!(request({ profile_photo: photo }))).status, 500);assert.deepEqual(existing, before);assert.equal(objects.has(oldPhoto), true);assert.equal(objects.size, 1);assert.deepEqual(deletes, uploads);
  });
  await check("cleanup network failure does not undo a successfully saved replacement", async () => {
    reset({ ...profile, photo_url: oldPhoto });failDelete = true;
    assert.equal((await handler!(request({ profile_photo: photo }))).status, 200);assert.equal(existing?.photo_url, uploads[0]);assert.equal(objects.has(uploads[0]), true);assert.equal(deletes.length, 3);
  });
  const wrongSize = Buffer.from(jpeg);wrongSize[7] = 0;
  const unsafe = Buffer.concat([Buffer.from([0xff,0xd8,0xff,0xe1,0,2]), jpeg.subarray(2)]);
  for (const bad of [null, {}, { mime_type: "image/jpeg", image_base64: "%%%" }, { ...photo, mime_type: "image/png" }, { ...photo, image_base64: wrongSize.toString("base64") }, { ...photo, image_base64: unsafe.toString("base64") }, { ...photo, image_base64: "A".repeat(Math.ceil(2 * 1024 * 1024 * 4 / 3) + 33) }]) {
    await check("invalid photo is rejected before upload/profile write", async () => {
      reset();const response = await handler!(request({ profile_photo: bad }));assert.ok([400,413].includes(response.status));
      assert.equal((await response.json()).field, "photo");assert.equal(writes.length + uploads.length, 0);assert.equal(existing, null);
    });
  }
  await check("photo_remove cannot remove the mandatory photo", async () => {
    reset({ ...profile, photo_url: oldPhoto });const before = structuredClone(existing), response = await handler!(request({ action: "photo_remove" }));
    assert.equal(response.status, 400);assert.equal((await response.json()).error, "PHOTO_REQUIRED");assert.deepEqual(existing, before);assert.equal(writes.length + deletes.length, 0);
  });
  await check("photo-only replacement remains available from the profile screen", async () => {
    reset({ ...profile, photo_url: oldPhoto });const response = await handler!(request({ action: "photo_upload", ...photo }));
    assert.equal(response.status, 200);assert.equal((await response.json()).photo_present, true);assert.equal(existing?.photo_url, uploads[0]);assert.equal(objects.size, 1);
  });
  await check("replacing a photo does not delete another in-flight upload", async () => {
    reset({ ...profile, photo_url: oldPhoto });const pending = `${userId}/44444444-4444-4444-8444-444444444444.webp`;objects.add(pending);
    assert.equal((await handler!(request({ action: "photo_upload", ...photo }))).status, 200);
    assert.equal(objects.has(pending), true);assert.equal(objects.has(existing?.photo_url), true);assert.deepEqual(deletes, [oldPhoto]);
  });
  await check("new photo uploads retain their stricter rate limit", async () => {
    reset();photoLimited = true;assert.equal((await handler!(request({ profile_photo: photo }))).status, 429);assert.equal(writes.length + uploads.length, 0);
  });
  await check("restricted users cannot upload or create profiles", async () => {
    reset();restricted = true;assert.equal((await handler!(request({ profile_photo: photo }))).status, 403);assert.equal(writes.length + uploads.length, 0);
  });
  await check("invalid Telegram signatures cause no database/storage requests", async () => {
    reset();const before = requests;assert.equal((await handler!(request({ initData: "auth_date=1&hash=00&user=%7B%22id%22%3A1%7D", profile_photo: photo }))).status, 401);assert.equal(requests, before);
  });
  console.log(`Required profile photo API checks passed: ${checks}`);
} finally { globalThis.fetch = originalFetch;(globalThis as any).Deno = originalDeno; }
