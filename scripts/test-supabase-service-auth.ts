import assert from "node:assert/strict";
import { serviceRoleAuthHeaders } from "../supabase/functions/_shared/supabase-service-auth.ts";

const modernKey = "sb_secret_test-only";
const modern = serviceRoleAuthHeaders(modernKey);
assert.equal(modern.apikey, modernKey);
assert.equal("Authorization" in modern, false, "opaque sb_secret keys must not be sent as Bearer JWTs");

const legacyKey = "legacy-service-role-jwt";
const legacy = serviceRoleAuthHeaders(legacyKey);
assert.equal(legacy.apikey, legacyKey);
assert.equal(legacy.Authorization, `Bearer ${legacyKey}`);

console.log("Supabase service-key header regression tests passed.");
