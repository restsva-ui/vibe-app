import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
const originalFetch=globalThis.fetch,originalDeno=(globalThis as any).Deno;
const actor='11111111-1111-4111-8111-111111111111',plan='44444444-4444-4444-8444-444444444444',peer='22222222-2222-4222-8222-222222222222',nonce='55555555-5555-4555-8555-555555555555';
const botToken='plans-test-fixture';let handler:(r:Request)=>Promise<Response>,restricted=false,limited=false,rpcError='',calls:any[]=[];
(globalThis as any).Deno={env:{get:(key:string)=>({TELEGRAM_BOT_TOKEN:botToken,SUPABASE_URL:'https://plans-fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'plans-test-key'} as Record<string,string>)[key]},serve:(fn:typeof handler)=>handler=fn};
globalThis.fetch=async(input:any,options:RequestInit={})=>{
  const url=new URL(String(input));assert.equal(url.origin,'https://plans-fixture.invalid','No real network');
  if(url.pathname==='/rest/v1/users')return Response.json([{id:actor,telegram_id:123,last_seen:new Date().toISOString(),account_status:restricted?'restricted':'active'}]);
  if(url.pathname==='/rest/v1/rpc/vybe_take_rate_limit')return Response.json({allowed:!limited,retry_after_seconds:9});
  assert.ok(['/rest/v1/rpc/vybe_plan','/rest/v1/rpc/vybe_plan_list'].includes(url.pathname));calls.push({...JSON.parse(String(options.body)),rpc:url.pathname});
  return rpcError?Response.json({message:rpcError},{status:400}):Response.json({ok:true,plan:{id:plan,host:{user_id:actor,name:'QA',photo_url:null}},notices:[],members:[],requests:[],messages:[]});
};
const fields={auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:123,first_name:'QA'})};
const secret=createHmac('sha256','WebAppData').update(botToken).digest();
const hash=createHmac('sha256',secret).update(Object.entries(fields).map(([k,v])=>k+'='+v).sort().join('\n')).digest('hex');
const initData=new URLSearchParams({...fields,hash}).toString();
const create={client_nonce:nonce,category:'pizza',title:'Pizza with company',description:'Test',city:'Київ',venue_label:'Pizzeria',visibility:'public',meeting_details:'Entrance',map_lat:50.45,map_lng:30.5,starts_at:new Date(Date.now()+3600000).toISOString(),duration_hours:2,capacity:2};
const request=(action:string,extra:Record<string,unknown>={})=>new Request('https://plans-fixture.invalid/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,initData,plan_id:plan,...extra})});
let checks=0;
try{
  await import('../supabase/functions/telegram-auth/index.ts');
  for(const action of ['plans_list','plans_my','plans_get','plans_create','plans_apply','plans_respond','plans_leave','plans_cancel','plans_message']){
    calls=[];const response=await handler!(request(action,{...create,user_id:peer,decision:'approved',body:'QA message',note:'Private note',p_user:peer,owner_id:peer}));
    assert.equal(response.status,200);const data=await response.json();assert.equal('notices' in data,false);assert.equal(calls[0].p_user,actor);assert.equal(calls[0].rpc,action==='plans_list'?'/rest/v1/rpc/vybe_plan_list':'/rest/v1/rpc/vybe_plan');if(action!=='plans_list')assert.equal(calls[0].p_action,action.slice(6));assert.equal('owner_id' in calls[0].p_input,false);assert.equal('p_user' in calls[0].p_input,false);checks++;
  }
  for(const [action,extra] of [
    ['plans_get',{plan_id:'bad'}],['plans_respond',{user_id:'bad',decision:'approved'}],['plans_respond',{user_id:peer,decision:'host'}],
    ['plans_message',{client_nonce:nonce,body:' '}],['plans_message',{client_nonce:'bad',body:'Test'}],['plans_message',{client_nonce:nonce,body:'x'.repeat(1001)}],
    ['plans_apply',{note:'x'.repeat(201)}],['plans_list',{category:'unknown'}],['plans_list',{day:'yesterday'}],
    ['plans_list',{bounds:{south:50,north:49,west:20,east:21}}],['plans_list',{bounds:{south:49,north:50,west:'20',east:21}}],
    ['plans_create',{...create,capacity:'2'}],['plans_create',{...create,capacity:21}],['plans_create',{...create,map_lat:null}],
    ['plans_create',{...create,map_lng:181}],['plans_create',{...create,visibility:'secret'}],['plans_create',{...create,meeting_details:''}],
    ['plans_create',{...create,starts_at:'not-a-date'}],['plans_create',{...create,duration_hours:2.5}],['plans_create',{...create,title:'x'.repeat(81)}],
  ] as Array<[string,Record<string,unknown>]>){calls=[];assert.equal((await handler!(request(action,extra))).status,400,action+JSON.stringify(extra));assert.equal(calls.length,0);checks++;}
  const range={starts_from:'2026-10-10T15:00:00.000Z',starts_before:'2026-10-10T19:00:00.000Z'};
  for(const extra of [{starts_from:range.starts_from},{starts_before:range.starts_before},{...range,starts_from:null},{...range,starts_before:7},
    {...range,starts_before:range.starts_from},{...range,starts_before:'2026-10-10T14:00:00.000Z'},
    {...range,starts_before:'2026-10-12T19:00:00.000Z'},{...range,starts_from:'2026-02-30T15:00:00.000Z'},
    {...range,starts_from:'2026-10-10T15:00'},{...range,day:'24h'}]){
    calls=[];assert.equal((await handler!(request('plans_list',extra))).status,400,JSON.stringify(extra));assert.equal(calls.length,0);checks++;
  }
  for(const extra of [range,{starts_from:'2026-10-24T21:00:00.000Z',starts_before:'2026-10-25T22:00:00.000Z'}]){
    calls=[];assert.equal((await handler!(request('plans_list',{...extra,owner_id:peer}))).status,200);assert.equal(calls[0].p_user,actor);assert.equal(calls[0].p_input.starts_from,extra.starts_from);assert.equal(calls[0].p_input.starts_before,extra.starts_before);assert.equal('owner_id' in calls[0].p_input,false);checks++;
  }
  calls=[];assert.equal((await handler!(request('plans_get',{initData:''}))).status,400);assert.equal(calls.length,0);checks++;
  assert.equal((await handler!(request('plans_get',{initData:initData.replace('hash=','hash=00')}))).status,401);checks++;
  restricted=true;calls=[];assert.equal((await handler!(request('plans_my'))).status,403);assert.equal(calls.length,0);restricted=false;checks++;
  limited=true;calls=[];const r=await handler!(request('plans_list'));assert.equal(r.status,429);assert.equal(r.headers.get('Retry-After'),'9');assert.equal(calls.length,0);limited=false;checks++;
  for(const [error,status] of [['PLAN_UNAVAILABLE',403],['PLAN_JOIN_REQUIRED',403],['PLAN_PROFILE_REQUIRED',403],['PLAN_FULL',409],['PLAN_CLOSED',409],['PLAN_RETRY_CHANGED',409],['INVALID_PLAN_TIME',400],['internal private address',503]] as const){rpcError=error;const r=await handler!(request('plans_get'));assert.equal(r.status,status);if(status===503)assert.equal((await r.json()).error,'PLANS_UNAVAILABLE');checks++;}
  console.log(`Plans API: ${checks} authentication, identity, validation, rate and error checks passed.`);
}finally{globalThis.fetch=originalFetch;(globalThis as any).Deno=originalDeno;}
