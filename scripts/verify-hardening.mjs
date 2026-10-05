import fs from "node:fs";

const app = fs.readFileSync("app.js", "utf8");
const index = fs.readFileSync("index.html", "utf8");
const auth = fs.readFileSync("supabase/functions/telegram-auth/index.ts", "utf8");
const bot = fs.readFileSync("supabase/functions/telegram-bot/index.ts", "utf8");

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
  for (const [name, source] of [["app.js", app], ["telegram-auth", auth], ["telegram-bot", bot]]) {
    if (pattern.test(source)) fail(`${label} found in ${name}`);
    pattern.lastIndex = 0;
  }
}

for (const [name, source, expected] of [
  ["telegram-auth", auth, 3],
  ["telegram-bot", bot, 2],
]) {
  const guards = source.match(/key\.startsWith\("sb_secret_"\)/g) || [];
  if (guards.length !== expected) {
    fail(`${name}: expected ${expected} sb_secret Authorization guards, found ${guards.length}`);
  }
  if (/^\s*Authorization:\s*`Bearer \$\{key\}`,/m.test(source)) {
    fail(`${name}: unguarded Supabase key is still sent as Bearer Authorization`);
  }
}

if (!auth.includes('"Access-Control-Max-Age": "86400"')) {
  fail("telegram-auth: CORS preflight caching is missing");
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

if (!index.includes("VYBE 0.9.47")) fail("index.html: version is not 0.9.47");
if (!index.includes("@supabase/supabase-js@2.117.2")) fail("index.html: Supabase JS dependency is not pinned to 2.117.2");
if (!app.includes('app_version:"0.9.47"')) fail("app.js: analytics version is not 0.9.47");

if (process.exitCode) process.exit(process.exitCode);
console.log("VYBE hardening checks passed.");
