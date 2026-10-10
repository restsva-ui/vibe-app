/** Parses only list controls; caller identity always comes from verified Telegram initData. */
export type RegistrationRange = "all" | "today" | "week";
type Cursor = { id: string; registered_at: string | null; snapshot_at: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function timestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 40) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d{1,6})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  if (year < 1000 || month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}
export function parseRegistrationInput(body: Record<string, unknown>): {
  range: RegistrationRange; cursor: Cursor | null;
} {
  const range = body.range ?? "all";
  if (range !== "all" && range !== "today" && range !== "week") throw new Error("INVALID_REGISTRATION_FILTER");
  if (body.cursor == null) return { range, cursor: null };
  if (typeof body.cursor !== "object" || Array.isArray(body.cursor)) throw new Error("INVALID_REGISTRATION_CURSOR");
  const c = body.cursor as Record<string, unknown>;
  if (typeof c.id !== "string" || !uuid.test(c.id) || !timestamp(c.snapshot_at) ||
      (c.registered_at !== null && !timestamp(c.registered_at)) ||
      (typeof c.registered_at === "string" && Date.parse(c.registered_at) > Date.parse(c.snapshot_at))) {
    throw new Error("INVALID_REGISTRATION_CURSOR");
  }
  // Preserve PostgreSQL microseconds: Date.toISOString() would truncate them.
  return { range, cursor: { id: c.id, registered_at: c.registered_at as string | null, snapshot_at: c.snapshot_at } };
}
