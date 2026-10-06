import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

const originalDeno = (globalThis as any).Deno;
const originalFetch = globalThis.fetch;
const userId = "11111111-1111-4111-8111-111111111111";
const botToken = "profile-bio-test-token";
let handler: (req: Request) => Promise<Response>;
let existing: Record<string, any> | null = null;
let restricted = false;
let limited = false;
const profileRequests: Array<{ method: string; payload: any }> = [];
let requests = 0;

(globalThis as any).Deno = {
  env: { get: (key: string) => ({
    TELEGRAM_BOT_TOKEN: botToken,
    SUPABASE_URL: "https://profile-fixture.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "profile-fixture-service-key",
  } as Record<string, string>)[key] },
  serve: (callback: typeof handler) => { handler = callback; },
};
globalThis.fetch = async (input: any, init?: RequestInit) => {
  requests++;
  const url = new URL(String(input));
  assert.equal(url.origin, "https://profile-fixture.invalid", "tests must never send real network requests");
  const method = init?.method || "GET";
  if (url.pathname === "/rest/v1/users") {
    assert.equal(method, "GET");
    return Response.json([{ id: userId, telegram_id: 123456, last_seen: new Date().toISOString(), account_status: restricted ? "restricted" : "active" }]);
  }
  if (url.pathname === "/rest/v1/rpc/vybe_take_rate_limit") {
    return Response.json({ allowed: !limited, retry_after_seconds: 10 });
  }
  if (url.pathname === "/rest/v1/profiles") {
    const payload = init?.body ? JSON.parse(String(init.body)) : null;
    profileRequests.push({ method, payload });
    if (method === "GET") return Response.json(existing ? [existing] : []);
    assert.ok(method === "POST" || method === "PATCH");
    existing = { ...existing, ...payload };
    return Response.json([existing]);
  }
  if (url.pathname === "/rest/v1/referrals") {
    assert.equal(method, "GET");
    return Response.json([]);
  }
  throw new Error("Unexpected API request: " + url.pathname);
};

const signedFields = {
  auth_date: String(Math.floor(Date.now() / 1000)),
  user: JSON.stringify({ id: 123456, first_name: "Test" }),
};
const checked = Object.entries(signedFields).map(([k, v]) => `${k}=${v}`).sort().join("\n");
const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
const signature = createHmac("sha256", secret).update(checked).digest("hex");
const initData = new URLSearchParams({ ...signedFields, hash: signature }).toString();
const request = (bio: unknown, extra: Record<string, any> = {}) => new Request("https://fixture.invalid/telegram-auth", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "save_profile", initData, profile: { name: "Test", age: 28, bio }, ...extra }),
});
let checks = 0;

try {
  await import("../supabase/functions/telegram-auth/index.ts");
  for (const bio of [undefined, null, "", " \n\t\u00a0 ", "\u200b\u200d\ufe0f", "\u0000", 123, [], {}]) {
    profileRequests.length = 0;
    const response = await handler!(request(bio));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { ok: false, error: "BIO_REQUIRED", field: "bio" });
    assert.equal(profileRequests.length, 0, "invalid bio must be rejected before reading or writing a profile");
    checks++;
  }
  let response = await handler!(request("  Люблю каву, гори й нові знайомства ☕  "));
  assert.equal(response.status, 200);
  assert.equal(existing?.bio, "Люблю каву, гори й нові знайомства ☕");
  assert.equal(profileRequests.at(-1)?.method, "POST");
  checks++;

  existing!.photo_url = "existing-photo";
  existing!.verified = true;
  const before = structuredClone(existing);
  profileRequests.length = 0;
  response = await handler!(request("   "));
  assert.equal(response.status, 400);
  assert.equal(profileRequests.length, 0);
  assert.deepEqual(existing, before, "clearing the bio must not modify an existing profile");
  checks++;

  response = await handler!(request("Кава ☕"));
  assert.equal(response.status, 200);
  assert.equal(profileRequests.at(-1)?.method, "PATCH");
  assert.equal(existing?.bio, "Кава ☕");
  assert.equal(existing?.photo_url, "existing-photo");
  assert.equal(existing?.verified, true);
  checks++;

  response = await handler!(request("а".repeat(250)));
  assert.equal(response.status, 200);
  assert.equal(existing?.bio.length, 180, "retain the existing server length limit");
  checks++;

  existing = { name: "Legacy", age: 41, bio: null, photo_url: "legacy-photo" };
  response = await handler!(request("Люблю мандрівки"));
  assert.equal(response.status, 200);
  assert.equal(existing?.bio, "Люблю мандрівки");
  assert.equal(existing?.photo_url, "legacy-photo");
  checks++;

  profileRequests.length = 0;
  const beforeRequests = requests;
  response = await handler!(request("Опис", { initData: "auth_date=1&hash=00&user=%7B%22id%22%3A123456%7D" }));
  assert.equal(response.status, 401);
  assert.equal(requests, beforeRequests);
  assert.equal(profileRequests.length, 0);
  checks++;

  restricted = true;
  response = await handler!(request("Опис"));
  assert.equal(response.status, 403);
  assert.equal(profileRequests.length, 0);
  restricted = false;
  checks++;

  limited = true;
  response = await handler!(request("Опис"));
  assert.equal(response.status, 429);
  assert.equal(profileRequests.length, 0);
  checks++;
  console.log(`Required profile bio API checks passed: ${checks}`);
} finally {
  globalThis.fetch = originalFetch;
  (globalThis as any).Deno = originalDeno;
}
