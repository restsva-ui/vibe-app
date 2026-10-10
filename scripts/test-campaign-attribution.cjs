const assert=require("node:assert/strict");
const campaign=require("../campaign-attribution.js");
const values=new Map();
const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
const now=1791652800000;
assert.equal(campaign.fromLaunch("https://fixture.invalid/?campaign=tt_261011_plans",{}),"261011_plans");
assert.equal(campaign.fromLaunch("https://fixture.invalid/?campaign=tt_other",{initData:"start_param=tt_signed"}),"signed");
assert.equal(campaign.fromLaunch("https://fixture.invalid/?tgWebAppStartParam=tt_261015_duet",{}),"261015_duet");
for(const value of ["ref_v123","plan_123","tt_","tt_../../x","tt_name?user=42","tt_"+"a".repeat(62)]){
  assert.equal(campaign.parseStart(value),null,"unrelated or unsafe launch values must stay unattributed");
}
assert.equal(campaign.parseStart("tt_"+"a".repeat(61)).length,61);
const first=campaign.forAccount("account-a","261011_plans",{storage,now});
assert.deepEqual(campaign.properties(first),{campaign_source:"tiktok",campaign_id:"261011_plans",utm_source:"tiktok",utm_medium:"organic_social",utm_campaign:"261011_plans"});
assert.deepEqual(campaign.forAccount("account-a",null,{storage,now:now+1000}),first,"reopening without a tag preserves the conversion source");
assert.equal(campaign.forAccount("account-b",null,{storage,now}),null,"a shared device must not attribute another account");
assert.equal(campaign.forAccount("account-a",null,{storage,now:now+7*86400000}),null,"the attribution window expires after seven days");
const latest=campaign.forAccount("account-a","261015_duet",{storage,now:now+10000});
assert.equal(latest.id,"261015_duet","a new campaign replaces the previous touch");
assert.equal(campaign.forAccount("account-a",null,{storage,enabled:false,now}),null);
assert.equal(values.has("vybeCampaign:account-a"),false,"opting out removes saved attribution");
assert.equal(campaign.forAccount("account-a","261011_plans",{storage:{getItem(){throw Error("blocked")},setItem(){throw Error("blocked")}},now}).id,"261011_plans","blocked storage must not stop app startup");
values.set("vybeCampaign:account-a",JSON.stringify({id:"safe",at:now+1}));
assert.equal(campaign.forAccount("account-a",null,{storage,now}),null,"future-dated stored data is ignored");
campaign.forAccount("account-a","261011_plans",{storage,now});campaign.clear("account-a",storage);
assert.equal(values.has("vybeCampaign:account-a"),false);
console.log("Campaign attribution: valid entry paths, safe tags, per-account scope, seven-day expiry, last touch, opt-out and unavailable storage passed");
