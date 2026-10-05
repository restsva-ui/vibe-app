import assert from "node:assert/strict";
import { validateTelegramInitData } from "../supabase/functions/_shared/telegram-init-data.ts";

const BOT_TOKEN = "vybe-test-token";

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
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

async function signedInitData(fields: Record<string, string>) {
  const dataCheckString = Object.entries(fields).map(([k, v]) => `${k}=${v}`).sort().join("\n");
  const secretKey = await hmac("WebAppData", BOT_TOKEN);
  const hash = toHex(await hmac(secretKey, dataCheckString));
  return new URLSearchParams({ ...fields, hash }).toString();
}

async function expectError(promise: Promise<unknown>, expected: string) {
  await assert.rejects(promise, (error: unknown) => {
    assert.equal(error instanceof Error ? error.message : String(error), expected);
    return true;
  });
}

const now = 2_000_000_000;
const user = JSON.stringify({ id: 123456, first_name: "VYBE", language_code: "uk" });

const valid = await signedInitData({ auth_date: String(now), query_id: "test-query", user });
const parsed = await validateTelegramInitData(valid, BOT_TOKEN, now);
assert.equal(parsed.authDate, now);
assert.equal(parsed.user.id, 123456);
assert.equal(parsed.user.first_name, "VYBE");

const tampered = new URLSearchParams(valid);
tampered.set("user", JSON.stringify({ id: 123456, first_name: "ATTACK" }));
await expectError(validateTelegramInitData(tampered.toString(), BOT_TOKEN, now), "Invalid Telegram signature");

await expectError(validateTelegramInitData("auth_date=1&user=%7B%22id%22%3A1%7D", BOT_TOKEN, now), "Telegram hash missing");

const future = await signedInitData({ auth_date: String(now + 61), user });
await expectError(validateTelegramInitData(future, BOT_TOKEN, now), "Telegram initData expired");

const futureBoundary = await signedInitData({ auth_date: String(now + 60), user });
assert.equal((await validateTelegramInitData(futureBoundary, BOT_TOKEN, now)).user.id, 123456);

const expired = await signedInitData({ auth_date: String(now - 86401), user });
await expectError(validateTelegramInitData(expired, BOT_TOKEN, now), "Telegram initData expired");

const expiryBoundary = await signedInitData({ auth_date: String(now - 86400), user });
assert.equal((await validateTelegramInitData(expiryBoundary, BOT_TOKEN, now)).authDate, now - 86400);

const invalidDate = await signedInitData({ auth_date: "not-a-number", user });
await expectError(validateTelegramInitData(invalidDate, BOT_TOKEN, now), "Invalid Telegram auth_date");

const missingUser = await signedInitData({ auth_date: String(now) });
await expectError(validateTelegramInitData(missingUser, BOT_TOKEN, now), "Telegram user missing");

const malformedUser = await signedInitData({ auth_date: String(now), user: "{" });
await expectError(validateTelegramInitData(malformedUser, BOT_TOKEN, now), "Invalid Telegram user");

const missingId = await signedInitData({ auth_date: String(now), user: JSON.stringify({ first_name: "No id" }) });
await expectError(validateTelegramInitData(missingId, BOT_TOKEN, now), "Telegram user id missing");

console.log("Telegram initData security tests passed.");
