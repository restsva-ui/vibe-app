/**
 * Build the Supabase service-key authentication headers used by server-side REST,
 * RPC, and Storage calls.
 *
 * Opaque sb_secret_ keys are API keys, not JWTs, so they must never be sent as
 * Bearer tokens. Legacy service-role JWTs keep Bearer compatibility.
 */
export function serviceRoleAuthHeaders(key: string): Record<string, string> {
  return key.startsWith("sb_secret_")
    ? { apikey: key }
    : { apikey: key, Authorization: `Bearer ${key}` };
}
