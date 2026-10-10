import { serviceRoleAuthHeaders } from '../_shared/supabase-service-auth.ts';
import { deliverGrowthAlerts } from '../_shared/owner-growth.ts';
import { calendarFile, publicPreview, validToken, APP_URL } from '../_shared/plan-invites.ts';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'content-type,authorization,apikey','Access-Control-Max-Age':'86400','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8'}});
async function rpc(name:string,body:Record<string,unknown>){
  const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),url=Deno.env.get('SUPABASE_URL');if(!key||!url)throw new Error('CONFIG');
  const r=await fetch(url+'/rest/v1/rpc/'+name,{method:'POST',headers:{...serviceRoleAuthHeaders(key),'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw new Error('DATABASE');return await r.json();
}
export async function handler(req:Request){
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method==='GET'){
    const url=new URL(req.url),calendar=url.searchParams.get('calendar'),token=calendar||url.searchParams.get('token');
    if(!validToken(token))return json({ok:false,error:'PLAN_INVITE_UNAVAILABLE'},404);
    try{
      const p=await rpc(calendar?'vybe_plan_calendar_export':'vybe_plan_invite_preview',calendar?{p_token:token}:{p_token:token,p_viewer:null});
      if(!p)return json({ok:false,error:'PLAN_INVITE_UNAVAILABLE'},404);
      if(calendar)return new Response(calendarFile(p),{headers:{...cors,'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'attachment; filename="VYBE-meetup.ics"'}});
      return json({ok:true,plan:publicPreview(p)});
    }catch{return json({ok:false,error:'PLANS_UNAVAILABLE'},503);}
  }
  if(req.method!=='POST')return json({ok:false},405);
  const auth=req.headers.get('authorization')||'';
  if(!/^Bearer [0-9a-f]{64}$/.test(auth))return json({ok:false},401);
  try{
    if(await rpc('vybe_plan_worker_authorized',{p_secret:auth.slice(7)})!==true)return json({ok:false},401);
    const jobs=await rpc('vybe_plan_reminder_claim',{});let sent=0;
    // Claimed sends aren't automatically replayed after an ambiguous network failure.
    await Promise.allSettled((jobs||[]).map(async(job:any)=>{
      let outcome='skipped',retry=0;
      try{
        if(await rpc('vybe_plan_reminder_allowed',{p_plan:job.plan_id,p_user:job.user_id,p_claim:job.claim})!==true)return;
        const bot=Deno.env.get('TELEGRAM_BOT_TOKEN');if(!bot)throw new Error('CONFIG');
        const response=await fetch('https://api.telegram.org/bot'+bot+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:Number(job.telegram_id),text:'VYBE 📍\n\nНагадування: твоя зустріч незабаром. Перевір час і домовленості у плані.\nYour meetup starts soon. Check the time and arrangements in your plan.',reply_markup:{inline_keyboard:[[{text:'Відкрити план / Open plan',web_app:{url:APP_URL+'?plan='+encodeURIComponent(job.plan_id)}}]]}}),signal:AbortSignal.timeout(10000)});
        const data=await response.json();
        if(response.ok&&data?.ok){outcome='sent';sent++;}
        else if(data?.error_code===429){outcome='retry';retry=Math.max(60,Math.min(3600,Number(data.parameters?.retry_after)||60));}
        else outcome='failed';
      }catch{outcome='unknown';}
      finally{await rpc('vybe_plan_reminder_finish',{p_plan:job.plan_id,p_user:job.user_id,p_claim:job.claim,p_outcome:outcome,p_retry:retry}).catch(()=>{});}
    }));
    const growth=await deliverGrowthAlerts(rpc,Deno.env.get('TELEGRAM_BOT_TOKEN'),APP_URL);
    return json({ok:true,processed:(jobs||[]).length,sent,growth});
  }catch{return json({ok:false,error:'REMINDERS_UNAVAILABLE'},503);}
}
Deno.serve(handler);
