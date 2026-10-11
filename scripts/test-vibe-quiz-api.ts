import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
const originalDeno=(globalThis as any).Deno,originalFetch=globalThis.fetch;
const token='quiz-fixture-token',userId='11111111-1111-4111-8111-111111111111';
let handler:(req:Request)=>Promise<Response>,restricted=false,profile:any={age:28},limited=false,failTelegram=false;
const calls:Array<{method:string;payload:any}>=[];
(globalThis as any).Deno={env:{get:(key:string)=>({TELEGRAM_BOT_TOKEN:token,SUPABASE_URL:'https://quiz-fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'quiz-fixture-key'} as Record<string,string>)[key]},serve:(callback:typeof handler)=>{handler=callback;}};
globalThis.fetch=async(input:any,init?:RequestInit)=>{
 const url=new URL(String(input)),method=init?.method||'GET';
 if(url.origin==='https://api.telegram.org'){
  assert.equal(url.pathname,'/bot'+token+'/savePreparedInlineMessage');const payload=JSON.parse(String(init?.body));calls.push({method:'savePreparedInlineMessage',payload});
  return Response.json(failTelegram?{ok:false,description:'unsupported'}:{ok:true,result:{id:'prepared',expiration_date:Math.floor(Date.now()/1000)+300}});
 }
 assert.equal(url.origin,'https://quiz-fixture.invalid','the test must never access production');
 assert.equal(method,url.pathname.endsWith('vybe_take_rate_limit')?'POST':'GET','quiz sharing must not write profiles or rewards');
 if(url.pathname==='/rest/v1/users')return Response.json([{id:userId,telegram_id:123456,last_seen:new Date().toISOString(),account_status:restricted?'restricted':'active'}]);
 if(url.pathname==='/rest/v1/profiles')return Response.json(profile?[profile]:[]);
 if(url.pathname==='/rest/v1/rpc/vybe_take_rate_limit')return Response.json({allowed:!limited,retry_after_seconds:10});
 throw new Error('Unexpected request '+url.pathname);
};
const fields={auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:123456,first_name:'PRIVATE NAME'})};
const secret=createHmac('sha256','WebAppData').update(token).digest();
const hash=createHmac('sha256',secret).update(Object.entries(fields).map(([k,v])=>k+'='+v).sort().join('\n')).digest('hex');
const signed=new URLSearchParams({...fields,hash}).toString();
const request=(extra:Record<string,unknown>={})=>new Request('https://fixture.invalid/telegram-auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'vibe_quiz_share',initData:signed,type:'spark',language:'uk',native:true,...extra})});
try{
 await import('../supabase/functions/telegram-auth/index.ts');
 assert.equal((await handler!(request({initData:''}))).status,400);assert.equal((await handler!(request({initData:signed.replace(hash,'00')}))).status,401);assert.equal(calls.length,0);
 restricted=true;assert.equal((await handler!(request())).status,403);restricted=false;
 profile=null;assert.equal((await handler!(request())).status,403);profile={age:17};assert.equal((await handler!(request())).status,403);profile={age:28};
 limited=true;assert.equal((await handler!(request())).status,429);limited=false;
 for(const type of ['bad','<img>','spark?user=1'])assert.equal((await handler!(request({type}))).status,400);
 for(const extra of [{language:'xx'},{native:'true'}])assert.equal((await handler!(request(extra))).status,400);
 assert.equal(calls.length,0,'invalid requests never prepare messages');
 for(const type of ['spark','explorer','cozy','talker'])for(const language of ['uk','en']){
  const response=await handler!(request({type,language,telegramId:999,user_id:'forged',text:'PRIVATE BIO',photo_url:'https://evil.invalid/'}));assert.equal(response.status,200);
  const data=await response.json(),payload=calls.at(-1)!.payload;
  assert.equal(payload.user_id,123456);assert.equal(payload.result.type,'photo');assert.match(payload.result.photo_url,new RegExp('quiz-'+type+'-'+language+'\\.jpg'));
  assert.equal(data.url,'https://t.me/vybe_now_bot?start=qz_'+type+'_v'+BigInt(123456).toString(36));assert.equal(payload.result.reply_markup.inline_keyboard[0][0].url,data.url);assert.equal(data.prepared_id,'prepared');
  for(const text of ['PRIVATE NAME','PRIVATE BIO','forged','evil.invalid'])assert.ok(!JSON.stringify(payload).includes(text));
 }
 const count=calls.length;assert.equal((await handler!(request({native:false}))).status,200);assert.equal(calls.length,count,'copy-only requests do not contact Telegram');
 failTelegram=true;const fallback=await (await handler!(request())).json();assert.equal(fallback.ok,true);assert.equal(fallback.prepared_id,null);assert.match(fallback.url,/qz_spark/);
 console.log('Quiz API: signed identity, account/profile/rate boundaries, all artwork variants and native fallback passed');
}finally{globalThis.fetch=originalFetch;(globalThis as any).Deno=originalDeno;}
