export const INTEREST_IDS = [
  "travel", "music", "cinema", "gaming", "books", "sport", "outdoors", "coffee",
  "food", "cooking", "art", "tech", "languages", "pets", "dancing", "photography",
] as const;
const supported = new Set<string>(INTEREST_IDS);

export function parseInterests(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 32) return null;
  if (value.some((x) => typeof x !== "string" || !supported.has(x))) return null;
  const unique = [...new Set<string>(value)];
  return unique.length <= 8 ? unique : null;
}

export function parseMapArea(enabled: unknown, lat: unknown, lng: unknown) {
  if (enabled === false) return { map_enabled: false, map_lat: null, map_lng: null };
  if (enabled !== true || typeof lat !== "number" || typeof lng !== "number"
    || !Number.isFinite(lat) || !Number.isFinite(lng)
    || lat < -85 || lat > 85 || lng < -180 || lng > 180) return null;
  return {
    map_enabled: true,
    map_lat: Number((Math.round(lat * 20) / 20).toFixed(2)),
    map_lng: Number((Math.round(lng * 20) / 20).toFixed(2)),
  };
}

export function parseMapBounds(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const b = value as Record<string, unknown>;
  const keys = ["south", "north", "west", "east"];
  if (keys.some((key) => typeof b[key] !== "number" || !Number.isFinite(b[key]))) return null;
  const { south, north, west, east } = b as Record<string, number>;
  if (south < -85 || north > 85 || west < -180 || east > 180 || south >= north || west >= east) return null;
  return { south, north, west, east };
}
