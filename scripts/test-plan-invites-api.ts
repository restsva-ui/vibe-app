import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {calendarFile} from '../supabase/functions/_shared/plan-invites.ts';
const originalFetch=globalThis.fetch,originalDeno=(globalThis as any).Deno;
const actor='11111111-1111-4111-8111-111111111111',plan='44444444-4444-4444-8444-444444444444',token='55555555-5555-4555-8555-555555555555',peer='22222222-2222-4222-8222-222222222222';
const bot='invite-test-fixture',secret='a'.repeat(64),base='https://invite-fixture.invalid';let handler:(req:Request)=>Promise<Response>,calls:any[]=[],restricted=false,limited=false,rpcError='',prepareFails=false,authAllowed=true,allowed=true,telegram429=false;
const preview={id:plan,title:'Pizza <script>\nATTENDEE:evil',category:'pizza',city:'Київ',venue_label:'Public pizzeria',visibility:'private',starts_at:new Date(Date.now()+1800000).toISOString(),ends_at:new Date(Date.now()+7200000).toISOString(),capacity:4,approved_count:2,meeting_details:'SECRET ADDRESS',host:{user_id:peer,name:'SECRET HOST'},members:[peer],token:'SECRET INTERNAL TOKEN',map_lat:50.452};
(globalThis as any).Deno={env:{get:(key:string)=>({TELEGRAM_BOT_TOKEN:bot,SUPABASE_URL:base,SUPABASE_SERVICE_ROLE_KEY:'test-key'} as Record<string,string>)[key]},serve:(fn:typeof handler)=>handler=fn};
globalThis.fetch=async(input:any,options:RequestInit={})=>{
 const url=new URL(String(input)),body=JSON.parse(String(options.body||'{}'));calls.push({url:url.pathname,body});
 if(url.origin==='https://api.telegram.org'){
  assert.ok(url.pathname.startsWith('/bot'+bot+'/'));
  if(url.pathname.endsWith('/savePreparedInlineMessage')){if(prepareFails)return Response.json({ok:false,description:'unsupported'},{status:400});assert.equal(body.user_id,123);assert.equal(body.result.input_message_content.message_text.includes('SECRET'),false);assert.equal(body.result.input_message_content.message_text.includes('<script>'),false);return Response.json({ok:true,result:{id:'prepared-fixture'}});}
  assert.ok(url.pathname.endsWith('/sendMessage'));assert.equal(body.text.includes('SECRET'),false);return telegram429?Response.json({ok:false,error_code:429,parameters:{retry_after:80}},{status:429}):Response.json({ok:true,result:{message_id:7}});
 }
 assert.equal(url.origin,base,'No external network in tests');
 if(url.pathname==='/rest/v1/users')return Response.json([{id:actor,telegram_id:123,last_seen:new Date().toISOString(),account_status:restricted?'restricted':'active'}]);
 if(url.pathname.endsWith('/vybe_take_rate_limit'))return Response.json({allowed:!limited,retry_after_seconds:9});
 if(rpcError)return Response.json({message:rpcError},{status:400});
 if(url.pathname.endsWith('/vybe_plan_invite_preview')||url.pathname.endsWith('/vybe_plan_calendar_export'))return Response.json(authAllowed?preview:null);
 if(url.pathname.endsWith('/vybe_plan_growth'))return Response.json(body.p_action==='calendar'?{token}:{enabled:true,delivered:false,token,plan:preview});
 if(url.pathname.endsWith('/vybe_plan_worker_authorized'))return Response.json(authAllowed);
 if(url.pathname.endsWith('/vybe_plan_reminder_claim'))return Response.json([{plan_id:plan,user_id:actor,claim:token,telegram_id:123}]);
 if(url.pathname.endsWith('/vybe_plan_reminder_allowed'))return Response.json(allowed);
 if(url.pathname.endsWith('/vybe_plan_reminder_finish'))return Response.json(null);
 throw new Error('Unexpected network: '+url.pathname);
};
const fields={auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:123,first_name:'QA'})},key=createHmac('sha256','WebAppData').update(bot).digest(),hash=createHmac('sha256',key).update(Object.entries(fields).map(([k,v])=>k+'='+v).sort().join('\n')).digest('hex'),initData=new URLSearchParams({...fields,hash}).toString();
const request=(action:string,extra:Record<string,unknown>={})=>new Request(base+'/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,initData,plan_id:plan,token,enabled:true,p_user:peer,user_id:peer,...extra})});
let checks=0;
try{
 await import('../supabase/functions/telegram-auth/index.ts');
 for(const action of ['plans_invite_get','plans_invite_update','plans_invite_preview','plans_share','plans_calendar','plans_reminder_get','plans_reminder_set']){
  calls=[];const r=await handler!(request(action,{native:true})),data=await r.json();assert.equal(r.status,200,action);
  const c=calls.find(c=>c.url.endsWith('/vybe_plan_growth')||c.url.endsWith('/vybe_plan_invite_preview'));assert.ok(c);assert.equal(action==='plans_invite_preview'?c.body.p_viewer:c.body.p_user,actor);assert.equal(JSON.stringify(data).includes('SECRET'),false);checks++;
 }
 for(const [action,extra] of [['plans_share',{plan_id:'bad'}],['plans_invite_preview',{token:'bad'}],['plans_invite_update',{enabled:'true'}],['plans_reminder_set',{enabled:1}]] as Array<[string,Record<string,unknown>]>) {calls=[];assert.equal((await handler!(request(action,extra))).status,400);assert.equal(calls.some(c=>c.url.endsWith('/vybe_plan_growth')),false);checks++;}
 for(const extra of [{initData:''},{initData:initData.replace('hash=','hash=00')}]){assert.ok((await handler!(request('plans_invite_get',extra))).status>=400);checks++;}
 restricted=true;calls=[];assert.equal((await handler!(request('plans_invite_preview'))).status,403);assert.equal(calls.some(c=>c.url.endsWith('/vybe_plan_invite_preview')),false);restricted=false;checks++;
 limited=true;assert.equal((await handler!(request('plans_share'))).status,429);limited=false;checks++;
 prepareFails=true;const fallback=await (await handler!(request('plans_share',{native:true}))).json();assert.equal(fallback.prepared_id,null);assert.match(fallback.url,/\?invite=/);prepareFails=false;checks++;
 for(const [e,status] of [['PLAN_UNAVAILABLE',403],['PLAN_JOIN_REQUIRED',403],['PLAN_INVITE_UNAVAILABLE',403],['PLAN_CLOSED',409],['secret internal database error',503]] as const){rpcError=e;const r=await handler!(request('plans_invite_get'));assert.equal(r.status,status);assert.equal(JSON.stringify(await r.json()).includes('secret internal'),false);checks++;}rpcError='';
 await import('../supabase/functions/plan-invite/index.ts');
 calls=[];assert.equal((await handler!(new Request(base+'?token=bad'))).status,404);assert.equal(calls.length,0);checks++;
 let r=await handler!(new Request(base+'?token='+token));const data=await r.json();assert.equal(r.status,200);assert.equal(JSON.stringify(data).includes('SECRET'),false);assert.equal('map_lat' in data.plan,false);checks++;
 authAllowed=false;assert.equal((await handler!(new Request(base+'?token='+token))).status,404);authAllowed=true;checks++;
 r=await handler!(new Request(base+'?calendar='+token));const ics=await r.text();assert.match(r.headers.get('content-type')||'',/text\/calendar/);assert.equal(ics.includes('SECRET'),false);assert.equal(ics.includes('Public pizzeria'),false);assert.equal(ics.includes('\r\nATTENDEE:'),false);checks++;
 for(const line of calendarFile({...preview,title:'Ї'.repeat(80)}).split('\r\n'))assert.ok(new TextEncoder().encode(line).length<=75);checks++;
 for(const authorization of ['', 'Bearer wrong', 'Bearer '+secret]){authAllowed=false;calls=[];const r=await handler!(new Request(base,{method:'POST',headers:{authorization}}));assert.equal(r.status,401);assert.equal(calls.some(c=>c.url.endsWith('/vybe_plan_reminder_claim')),false);checks++;}authAllowed=true;
 calls=[];r=await handler!(new Request(base,{method:'POST',headers:{authorization:'Bearer '+secret}}));assert.equal(r.status,200);assert.equal((await r.json()).sent,1);assert.equal(calls.find(c=>c.url.endsWith('/vybe_plan_reminder_finish')).body.p_outcome,'sent');checks++;
 allowed=false;calls=[];await handler!(new Request(base,{method:'POST',headers:{authorization:'Bearer '+secret}}));assert.equal(calls.some(c=>c.url.endsWith('/sendMessage')),false);assert.equal(calls.find(c=>c.url.endsWith('/vybe_plan_reminder_finish')).body.p_outcome,'skipped');allowed=true;checks++;
 telegram429=true;calls=[];await handler!(new Request(base,{method:'POST',headers:{authorization:'Bearer '+secret}}));const finish=calls.find(c=>c.url.endsWith('/vybe_plan_reminder_finish')).body;assert.equal(finish.p_outcome,'retry');assert.equal(finish.p_retry,80);checks++;
 console.log(`Plan invitations/calendar/reminders: ${checks} authentication, privacy, serialization and worker checks passed.`);
}finally{globalThis.fetch=originalFetch;(globalThis as any).Deno=originalDeno;}
