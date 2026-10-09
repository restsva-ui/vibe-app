import fs from "node:fs";

const app = fs.readFileSync("app.js", "utf8");
const chatMedia = fs.readFileSync("chat-media.js", "utf8");
const mediaApi = fs.readFileSync("supabase/functions/_shared/chat-media-api.ts", "utf8");
const index = fs.readFileSync("index.html", "utf8");
const auth = fs.readFileSync("supabase/functions/telegram-auth/index.ts", "utf8");
const bot = fs.readFileSync("supabase/functions/telegram-bot/index.ts", "utf8");
const telegramInitData = fs.readFileSync("supabase/functions/_shared/telegram-init-data.ts", "utf8");
const serviceAuth = fs.readFileSync("supabase/functions/_shared/supabase-service-auth.ts", "utf8");

const fail = (message) => {
  console.error("HARDENING CHECK FAILED:", message);
  process.exitCode = 1;
};

const secretPatterns = [
  ["Groq API key", /gsk_[A-Za-z0-9_-]{20,}/g],
  ["OpenAI API key", /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g],
  ["Telegram bot token", /\b\d{6,12}:[A-Za-z0-9_-]{20,}\b/g],
  ["Supabase secret key literal", /sb_secret_[A-Za-z0-9_-]{20,}/g],
];

for (const [label, pattern] of secretPatterns) {
  for (const [name, source] of [
    ["app.js", app],
    ["chat-media.js", chatMedia],
    ["chat-media-api", mediaApi],
    ["telegram-auth", auth],
    ["telegram-bot", bot],
    ["telegram-init-data", telegramInitData],
    ["supabase-service-auth", serviceAuth],
  ]) {
    if (pattern.test(source)) fail(`${label} found in ${name}`);
    pattern.lastIndex = 0;
  }
}

for (const [name, source, expected] of [
  ["telegram-auth", auth, 3],
  ["telegram-bot", bot, 2],
]) {
  const uses = source.match(/serviceRoleAuthHeaders\(key\)/g) || [];
  if (uses.length !== expected) {
    fail(`${name}: expected ${expected} shared service-key header calls, found ${uses.length}`);
  }
  if (source.includes('key.startsWith("sb_secret_")')) {
    fail(`${name}: service-key classification logic was duplicated outside the shared module`);
  }
  if (/^\s*Authorization:\s*`Bearer \${key}`,/m.test(source)) {
    fail(`${name}: unguarded Supabase key is still sent as Bearer Authorization`);
  }
}
if (!serviceAuth.includes('key.startsWith("sb_secret_")')) {
  fail("shared Supabase service-key classifier is missing");
}
if (!serviceAuth.includes("? { apikey: key }")) {
  fail("shared Supabase service-key classifier does not omit Bearer auth for opaque keys");
}

if (!auth.includes('import { validateTelegramInitData } from "../_shared/telegram-init-data.ts";')) {
  fail("telegram-auth: Telegram initData validator is not using the shared tested module");
}
if (!telegramInitData.includes("export async function validateTelegramInitData")) {
  fail("shared Telegram initData validator is missing");
}

if (!auth.includes('"Access-Control-Max-Age": "86400"')) {
  fail("telegram-auth: CORS preflight caching is missing");
}
if (!auth.includes("resolveTelegramWebhookSecret") || !auth.includes("vybe:telegram-webhook:")) {
  fail("telegram-auth: deterministic Telegram webhook secret fallback is missing");
}
if (!bot.includes("resolveWebhookSecret") || !bot.includes("ensureDerivedWebhookConfigured") || !bot.includes("secret_token: secret")) {
  fail("telegram-bot: derived webhook secret self-healing is missing");
}

if (!app.includes("const SOCIAL_RECONCILE_INTERVAL_MS=120000;")) {
  fail("app.js: reconciliation interval is not 120 seconds");
}
if (!app.includes('accountStatus!=="active"||realtimeConnected')) {
  fail("app.js: fallback polling is not gated by Realtime state");
}

const referralChecks = [
  "escapeHtml(x.milestone)",
  "escapeHtml(x.label)",
  "escapeHtml(x.progress)",
  "escapeHtml(r.invited)",
  "escapeHtml(r.activated)",
];
for (const token of referralChecks) {
  if (!app.includes(token)) fail(`app.js: referral HTML is missing ${token}`);
}

if (!index.includes("VYBE 0.9.49")) fail("index.html: version is not 0.9.49");
if (!index.includes("@supabase/supabase-js@2.117.2")) fail("index.html: Supabase JS dependency is not pinned to 2.117.2");
if (!app.includes('app_version:"0.9.49"')) fail("app.js: analytics version is not 0.9.49");

if (process.exitCode) process.exit(process.exitCode);
console.log("VYBE hardening checks passed.");
