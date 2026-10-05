import assert from "node:assert/strict";
import { INTEREST_IDS, parseInterests, parseMapArea, parseMapBounds } from "../supabase/functions/_shared/discovery-preferences.ts";

assert.equal(INTEREST_IDS.length, 16);
assert.deepEqual(parseInterests(["coffee", "travel", "coffee"]), ["coffee", "travel"]);
assert.deepEqual(parseInterests([]), []);
for (const invalid of [null, "coffee", ["unknown"], [null], [...INTEREST_IDS.slice(0, 9)], Array(33).fill("coffee")]) {
  assert.equal(parseInterests(invalid), null);
}
assert.deepEqual(parseMapArea(true, 50.456789, 30.523456), {map_enabled:true,map_lat:50.45,map_lng:30.5});
assert.deepEqual(parseMapArea(true, -33.923, -70.643), {map_enabled:true,map_lat:-33.9,map_lng:-70.65});
assert.deepEqual(parseMapArea(false, 50.45, 30.5), {map_enabled:false,map_lat:null,map_lng:null});
for (const invalid of [[true, null, null], [true, "50.45", 30.5], [true, NaN, 30], [true, 90, 30], [true, 50, 181], ["true", 50, 30]]) {
  assert.equal(parseMapArea(...invalid as [unknown, unknown, unknown]), null);
}
const bounds={south:50.4,north:50.6,west:30.3,east:30.7};
assert.deepEqual(parseMapBounds(bounds),bounds);
for(const invalid of [null, [], {...bounds,south:"50"}, {...bounds,north:50.3}, {...bounds,west:181}, {...bounds,east:Infinity}]) {
  assert.equal(parseMapBounds(invalid),null);
}
console.log("Discovery preference tests passed: interest validation, coarse areas, removal and map bounds.");
