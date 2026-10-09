import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
const originalFetch=globalThis.fetch, originalDeno=(globalThis as any).Deno;
const actor='11111111-1111-4111-8111-111111111111', match='44444444-4444-4444-8444-444444444444';
let handler: (req: Request)=>Promise<Response>, restricted=false, limited=false, rpcError='', calls: any[]=[];
const botToken='duet-test-fixture';
(globalThis as any).Deno={env:{get:(key:string)=>({TELEGRAM_BOT_TOKEN:botToken,SUPABASE_URL:'https://duet-fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'duet-fixture-service-key'} as Record<string,string>)[key]},serve:(fn:typeof handler)=>{handler=fn;}};
globalThis.fetch=async(input:any,options:RequestInit={})=>{
  const url=new URL(String(input));assert.equal(url.origin,'https://duet-fixture.invalid','no real network calls');
  if(url.pathname==='/rest/v1/users')return Response.json([{id:actor,telegram_id:321,last_seen:new Date().toISOString(),account_status:restricted?'restricted':'active'}]);
  if(url.pathname==='/rest/v1/rpc/vybe_take_rate_limit')return Response.json({allowed:!limited,retry_after_seconds:12});
  assert.equal(url.pathname,'/rest/v1/rpc/vybe_duet');calls.push(JSON.parse(String(options.body)));
  return rpcError?Response.json({message:rpcError},{status:400}):Response.json({ok:true,state:'playing',my_progress:0,peer_progress:0});
};
const fields={auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:321,first_name:'QA'})};
const secret=createHmac('sha256','WebAppData').update(botToken).digest();
const hash=createHmac('sha256',secret).update(Object.entries(fields).map(([k,v])=>k+'='+v).sort().join('\n')).digest('hex');
const initData=new URLSearchParams({...fields,hash}).toString();
const request=(action:string,extra:Record<string,unknown>={})=>new Request('https://duet-fixture.invalid/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,initData,match_id:match,...extra})});
let checks=0;
try{
  await import('../supabase/functions/telegram-auth/index.ts');
  for(const action of ['duet_get','duet_start','duet_join','duet_answer']){
    calls=[];const response=await handler!(request(action,{question_index:0,choice:1,guess:0,user_id:'forged',p_user:'forged'}));
    assert.equal(response.status,200);assert.equal(calls.length,1);assert.equal(calls[0].p_user,actor);assert.equal(calls[0].p_action,action.slice(5));assert.equal(calls[0].p_input.match_id,match);
    assert.equal('user_id' in calls[0].p_input,false);checks++;
  }
  for(const extra of [{match_id:'not-a-uuid'},{question_index:3,choice:0,guess:0},{question_index:0,choice:'1',guess:0},{question_index:0,choice:1,guess:null},{question_index:0.5,choice:1,guess:0}]){
    calls=[];const response=await handler!(request('duet_answer',extra));assert.equal(response.status,400);assert.equal(calls.length,0);checks++;
  }
  calls=[];assert.equal((await handler!(request('duet_start',{initData:''}))).status,400);assert.equal(calls.length,0);checks++;
  assert.equal((await handler!(request('duet_start',{initData:initData.replace('hash=','hash=00')}))).status,401);checks++;
  restricted=true;calls=[];assert.equal((await handler!(request('duet_get'))).status,403);assert.equal(calls.length,0);restricted=false;checks++;
  limited=true;calls=[];const limitedResponse=await handler!(request('duet_answer',{question_index:0,choice:1,guess:0}));assert.equal(limitedResponse.status,429);assert.equal(limitedResponse.headers.get('Retry-After'),'12');assert.equal(calls.length,0);limited=false;checks++;
  for(const [error,status] of [['CHAT_UNAVAILABLE',403],['DUET_JOIN_REQUIRED',409],['DUET_ANSWER_LOCKED',409],['INVALID_DUET_ANSWER',400],['private database detail',503]] as const){rpcError=error;const r=await handler!(request('duet_get'));assert.equal(r.status,status);if(status===503)assert.equal((await r.json()).error,'DUET_UNAVAILABLE');checks++;}
  console.log(`Duet API: ${checks} authentication, identity, validation and error-boundary checks passed.`);
}finally{globalThis.fetch=originalFetch;(globalThis as any).Deno=originalDeno;}
