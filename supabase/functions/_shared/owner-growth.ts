type Rpc = (name: string, body: Record<string, unknown>) => Promise<any>;
type GrowthEvent = { id: string; kind: string; occurred_at: string };
type GrowthBatch = { claim: string; telegram_id: number | string; events: GrowthEvent[]; users_total?: number; profiles_total?: number };
const eventKinds = new Set(["user_registered", "profile_created", "system_ready"]);
const count = (value: unknown) => Math.max(0, Number(value) || 0);

export function growthMessage(batch: GrowthBatch): string {
  const events = batch.events.filter(event => eventKinds.has(event.kind));
  const registrations = events.filter(event => event.kind === "user_registered").length;
  const profiles = events.filter(event => event.kind === "profile_created").length;
  const setup = events.some(event => event.kind === "system_ready");
  const lines = ["VYBE 💜", ""];
  if (setup) lines.push("✅ Сповіщення про нові реєстрації увімкнено.");
  if (registrations) lines.push(registrations === 1 ? "🆕 Зареєструвався новий користувач." : "🆕 Нових користувачів: " + registrations);
  if (profiles) lines.push(profiles === 1 ? "✨ Створено першу анкету користувача." : "✨ Перших анкет: " + profiles);
  lines.push("", "Усього користувачів: " + count(batch.users_total), "Створених анкет: " + count(batch.profiles_total));
  const times = events.map(event => Date.parse(event.occurred_at)).filter(Number.isFinite);
  if (times.length) lines.push("Час: " + new Intl.DateTimeFormat("uk-UA", {timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"}).format(Math.max(...times)) + " (Київ)");
  lines.push("", "У VYBE: Профіль → Користувачі VYBE.");
  if (setup) lines.push("Твій доступ власника: VYBE+, SuperVYBE та Spotlight без покупок.");
  return lines.join("\n");
}

export async function deliverGrowthAlerts(rpc: Rpc, botToken: string | undefined, appUrl: string) {
  if (!botToken) throw new Error("CONFIG");
  const batch = await rpc("vybe_growth_claim", {}) as GrowthBatch | null;
  if (!batch) return {processed: 0, sent: 0, outcome: "idle", recorded: true};
  let outcome = "skipped", retry = 0, transportStarted = false, processed = 0, sent = 0;
  try {
    const payload = await rpc("vybe_growth_payload", {p_claim: batch.claim}) as GrowthBatch | null;
    const chatId = Number(payload?.telegram_id);
    if (payload && Array.isArray(payload.events) && payload.events.length &&
        payload.events.every(event => eventKinds.has(event.kind)) &&
        Number.isSafeInteger(chatId) && chatId > 0) {
      processed = payload.events.length;
      transportStarted = true;
      const response = await fetch("https://api.telegram.org/bot" + botToken + "/sendMessage", {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({chat_id: chatId, text: growthMessage(payload), reply_markup: {inline_keyboard: [[{text: "Відкрити VYBE", web_app: {url: appUrl}}]]}}),
        signal: AbortSignal.timeout(10000),
      });
      const data = await response.json();
      if (response.ok && data?.ok === true) {outcome = "sent"; sent = 1;}
      else if (data?.error_code === 429) {
        outcome = "retry"; retry = Math.max(60, Math.min(3600, Number(data.parameters?.retry_after) || 60));
      } else outcome = "failed";
    }
  } catch {
    // Retry only when no Telegram request has started. Ambiguous sends are never replayed.
    outcome = transportStarted ? "unknown" : "retry";
    retry = transportStarted ? 0 : 60;
  }
  let recorded = true;
  try {await rpc("vybe_growth_finish", {p_claim: batch.claim, p_outcome: outcome, p_retry: retry});}
  catch {recorded = false;}
  return {processed, sent, outcome, recorded};
}
