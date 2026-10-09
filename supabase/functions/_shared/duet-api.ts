import { UUID_RE } from "./chat-media.ts";

export const DUET_ACTIONS = new Set(["duet_get", "duet_start", "duet_join", "duet_answer"]);
type Context = {
  userId: string;
  rpc: (name: string, input: Record<string, unknown>) => Promise<any>;
};

// Actor identity comes exclusively from verified Telegram initData.
export async function handleDuetAction(action: string, body: Record<string, unknown>, ctx: Context) {
  if (!DUET_ACTIONS.has(action) || typeof body.match_id !== "string" || !UUID_RE.test(body.match_id)) {
    return { status: 400, data: { ok: false, error: "INVALID_DUET_REQUEST" } };
  }
  const input: Record<string, unknown> = { match_id: body.match_id };
  if (action === "duet_answer") {
    for (const [key, max] of [["question_index", 2], ["choice", 1], ["guess", 1]] as const) {
      const value = body[key];
      if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > max) {
        return { status: 400, data: { ok: false, error: "INVALID_DUET_ANSWER" } };
      }
      input[key] = value;
    }
  }
  try {
    const data = await ctx.rpc("vybe_duet", {
      p_user: ctx.userId, p_action: action.slice(5), p_input: input,
    });
    return { status: 200, data };
  } catch (e) {
    const message = String(e instanceof Error ? e.message : e);
    const error = ["CHAT_UNAVAILABLE", "DUET_NOT_STARTED", "DUET_JOIN_REQUIRED", "DUET_ANSWER_LOCKED", "INVALID_DUET_ANSWER", "INVALID_DUET_REQUEST"]
      .find(code => message.includes(code)) || "DUET_UNAVAILABLE";
    const status = error === "CHAT_UNAVAILABLE" ? 403 : error.startsWith("INVALID_") ? 400 : error === "DUET_UNAVAILABLE" ? 503 : 409;
    return { status, data: { ok: false, error } };
  }
}
