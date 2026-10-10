import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {parseRegistrationInput} from "../supabase/functions/_shared/owner-registrations.ts";
import {deliverGrowthAlerts,growthMessage} from "../supabase/functions/_shared/owner-growth.ts";
const originalFetch=globalThis.fetch,originalDeno=(globalThis as any).Deno;
const base="https://growth-fixture.invalid",bot="growth-test-token",actor="11111111-1111-4111-8111-111111111111",peer="22222222-2222-4222-8222-222222222222";
let handler:(r:Request)=>Promise<Response>,role:string|null=null,restricted=false,paidPlus=false,failSummary=false,failList:string|null=null;
let calls:Array<{path:string;method:string;body:any}>=[];
(globalThis as any).Deno={env:{get:(key:string)=>({SUPABASE_URL:base,SUPABASE_SERVICE_ROLE_KEY:"test-key",TELEGRAM_BOT_TOKEN:bot} as Record<string,string>)[key]},serve:(fn:typeof handler)=>handler=fn};
globalThis.fetch=async(input:any,init:RequestInit={})=>{
 const u=new URL(String(input)),body=JSON.parse(String(init.body||"{}"));calls.push({path:u.pathname,method:init.method||"GET",body});
 assert.equal(u.origin,base,"No production traffic");
 if(u.pathname==="/rest/v1/users")return Response.json([{id:actor,telegram_id:123,last_seen:new Date().toISOString(),account_status:restricted?"restricted":"active"}]);
 if(u.pathname==="/rest/v1/admin_users")return Response.json(role?[{role}]:[]);
 if(u.pathname.endsWith("/vybe_take_rate_limit"))return Response.json({allowed:true});
 if(u.pathname.endsWith("/vybe_admin_growth_summary")){assert.equal(body.p_actor,actor);return failSummary?Response.json({message:"private failure"},{status:500}):Response.json({users_total:1423,profiles_total:1001,new_users_today:23,snapshot_at:new Date().toISOString()});}
 if(u.pathname.endsWith("/vybe_owner_registrations")){
  assert.equal(body.p_actor,actor);assert.equal(body.p_limit,25);assert.equal(role,"owner");
  return failList?Response.json({message:failList},{status:500}):Response.json({users:[],total:1423,snapshot_at:"2026-10-10T19:00:00.123456+00:00",has_more:false,next_cursor:null});
 }
 if(u.pathname==="/rest/v1/user_entitlements")return Response.json(paidPlus?[{vybe_plus_until:new Date(Date.now()+86400000).toISOString()}]:[]);
 if(u.pathname.endsWith("/use_spotlight")){assert.equal(body.p_user_id,actor);return Response.json({owner_access:role==="owner",spotlight_until:new Date(Date.now()+1800000).toISOString()});}
 if(u.pathname.endsWith("/vybe_like_and_match")){assert.equal(body.p_user_id,actor);assert.equal(body.p_target_user_id,peer);return Response.json({matched:false,super_charged:false,like_created:false});}
 if(["referral_rewards","paid_rewards","reward_uses","likes","blocks","matches"].some(t=>u.pathname==="/rest/v1/"+t))return Response.json([]);
 throw Error("Unexpected call "+u.pathname);
};
const fields={auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:123,first_name:"QA"})},key=createHmac("sha256","WebAppData").update(bot).digest(),hash=createHmac("sha256",key).update(Object.entries(fields).map(([k,v])=>k+"="+v).sort().join("\n")).digest("hex"),initData=new URLSearchParams({...fields,hash}).toString();
const request=(action:string,extra:Record<string,unknown>={})=>new Request(base,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,initData,...extra})});
let checks=0;
try{
 await import("../supabase/functions/telegram-auth/index.ts");
 for(const r of [null,"admin","owner"]){
  role=r;calls=[];const response=await handler!(request("entitlements",{owner_access:true,admin_role:"owner",user_id:peer})),data=await response.json();
  assert.equal(response.status,200);assert.equal(data.owner_access,r==="owner");assert.deepEqual(data.balances,{supervybe:0,spotlight:0});assert.equal(data.vybe_plus_until,null);assert.equal(calls.some(c=>c.method==="POST"&&!c.path.includes("/rpc/")),false);checks++;
  const likes=await handler!(request("likes_received"));assert.equal(likes.status,r==="owner"?200:403);checks++;
  calls=[];const stats=await handler!(request("admin_growth_summary",{p_actor:peer,admin_role:"owner"}));assert.equal(stats.status,r?200:403);assert.equal(calls.some(c=>c.path.endsWith("/vybe_admin_growth_summary")),!!r);if(r)assert.equal((await stats.json()).counts.users_total,1423);checks++;
  calls=[];const list=await handler!(request("admin_registrations_list",{p_actor:peer,user_id:peer,admin_role:"owner",owner_access:true,limit:100000}));
  assert.equal(list.status,r==="owner"?200:403);assert.equal(calls.some(c=>c.path.endsWith("/vybe_owner_registrations")),r==="owner");checks++;
 }
 role="owner";
 const cursor={id:peer,registered_at:"2026-10-10T18:00:00.123456+00:00",snapshot_at:"2026-10-10T19:00:00.123456+00:00"};
 calls=[];assert.equal((await handler!(request("admin_registrations_list",{range:"today",cursor}))).status,200);
 const listCall=calls.find(c=>c.path.endsWith("/vybe_owner_registrations"))!;assert.equal(listCall.body.p_range,"today");assert.equal(listCall.body.p_before_time,cursor.registered_at);assert.equal(listCall.body.p_before_id,peer);assert.equal(listCall.body.p_snapshot,cursor.snapshot_at);checks++;
 assert.deepEqual(parseRegistrationInput({cursor:{...cursor,registered_at:null}}).cursor,{...cursor,registered_at:null});checks++;
 for(const extra of [{range:"month"},{range:[]},{cursor:"bad"},{cursor:{}},{cursor:{...cursor,id:"bad"}},{cursor:{...cursor,snapshot_at:"2026-02-30T00:00:00Z"}},{cursor:{...cursor,registered_at:"2026-10-11T00:00:00Z"}}]){
  calls=[];assert.equal((await handler!(request("admin_registrations_list",extra))).status,400);assert.equal(calls.some(c=>c.path.endsWith("/vybe_owner_registrations")),false);checks++;
 }
 for(const failure of ["private failure","OWNER_REQUIRED"]){
  failList=failure;const r=await handler!(request("admin_registrations_list"));assert.equal(r.status,failure==="OWNER_REQUIRED"?403:503);assert.equal(JSON.stringify(await r.json()).includes("private failure"),false);checks++;
 }
 failList=null;
 calls=[];assert.ok((await handler!(request("admin_registrations_list",{initData:"bad"}))).status>=400);assert.equal(calls.length,0);checks++;
 role=null;paidPlus=true;assert.equal((await handler!(request("likes_received"))).status,200);paidPlus=false;checks++;
 role="owner";calls=[];assert.equal((await handler!(request("star_invoice",{product_key:"supervybe_5",terms_accepted:true}))).status,409);assert.equal(calls.some(c=>c.path.includes("star_orders")),false);checks++;
 for(const action of ["super_like","spotlight_use"]){assert.equal((await handler!(request(action,{target_user_id:peer,user_id:peer,p_user_id:peer}))).status,200);checks++;}
 failSummary=true;const failed=await handler!(request("admin_growth_summary"));assert.equal(failed.status,503);assert.equal(JSON.stringify(await failed.json()).includes("private failure"),false);failSummary=false;checks++;
 restricted=true;assert.equal((await handler!(request("spotlight_use"))).status,403);restricted=false;checks++;
 calls=[];assert.ok((await handler!(request("admin_growth_summary",{initData:""}))).status>=400);assert.equal(calls.length,0);checks++;

 const claim="33333333-3333-4333-8333-333333333333",events=[{id:"a",kind:"user_registered",occurred_at:"2026-10-10T19:00:00Z"},{id:"b",kind:"profile_created",occurred_at:"2026-10-10T19:00:01Z"}];
 const batch={claim,telegram_id:987,events,users_total:1423,profiles_total:1001};
 for(const mode of ["success","rate-limit","ambiguous","denied","payload-failure","permanent","invalid-kind","finish-failure"]){
  let sends=0,finish:any=null;
  const rpc=async(name:string,body:Record<string,unknown>)=>{
   if(name==="vybe_growth_claim")return batch;
   if(name==="vybe_growth_payload"){assert.equal(body.p_claim,claim);if(mode==="payload-failure")throw Error("db unavailable");return mode==="denied"?null:mode==="invalid-kind"?{...batch,events:[{id:"c",kind:"<private>",occurred_at:"bad"}]}:batch;}
   if(name==="vybe_growth_finish"){finish=body;if(mode==="finish-failure")throw Error("db finish failed");return null;}
   throw Error(name);
  };
  globalThis.fetch=async(input:any,init:RequestInit={})=>{
   assert.equal(new URL(String(input)).origin,"https://api.telegram.org");const body=JSON.parse(String(init.body));assert.equal(body.chat_id,987);assert.equal(body.text.includes("11111111"),false);assert.equal(body.text.includes("1423"),true);sends++;
   if(mode==="ambiguous")throw Error("response lost after send");
   if(mode==="rate-limit")return Response.json({ok:false,error_code:429,parameters:{retry_after:80}},{status:429});
   if(mode==="permanent")return Response.json({ok:false,error_code:403},{status:403});
   return Response.json({ok:true,result:{message_id:1}});
  };
  const result=await deliverGrowthAlerts(rpc,bot,"https://example.invalid/app");
  const expected:Record<string,string>={success:"sent","rate-limit":"retry",ambiguous:"unknown",denied:"skipped","payload-failure":"retry",permanent:"failed","invalid-kind":"skipped","finish-failure":"sent"};
  assert.equal(finish.p_outcome,expected[mode]);assert.equal(sends,["denied","payload-failure","invalid-kind"].includes(mode)?0:1);assert.equal(result.recorded,mode!=="finish-failure");if(mode==="rate-limit")assert.equal(finish.p_retry,80);checks++;
 }
 let rpcCalls=0;assert.equal((await deliverGrowthAlerts(async()=>{rpcCalls++;return null;},bot,"https://example.invalid")).sent,0);assert.equal(rpcCalls,1);checks++;
 await assert.rejects(()=>deliverGrowthAlerts(async()=>{throw Error("must not claim");},undefined,"https://example.invalid"),/CONFIG/);checks++;
 const setup=growthMessage({...batch,events:[{id:"s",kind:"system_ready",occurred_at:"2026-10-10T19:00:00Z"}]});assert.match(setup,/увімкнено/);assert.equal(setup.includes("новий користувач."),false);checks++;
 console.log("Owner access and growth alerts: "+checks+" authorization, billing, privacy, batching and retry checks passed.");
}finally{globalThis.fetch=originalFetch;(globalThis as any).Deno=originalDeno;}
