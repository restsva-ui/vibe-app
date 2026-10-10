export const PLAN_GROWTH_ACTIONS = new Set(['plans_invite_get','plans_invite_update','plans_invite_preview','plans_share','plans_calendar','plans_reminder_get','plans_reminder_set']);
export const APP_URL = 'https://restsva-ui.github.io/vibe-app/';
export const validToken = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function publicPreview(input: Record<string, any>) {
  const keys = ['id','category','title','city','venue_label','visibility','starts_at','ends_at','capacity','approved_count'];
  return Object.fromEntries(keys.map(key=>[key,input[key]]));
}
export function calendarFile(input: Record<string, any>) {
  const p=publicPreview(input), escape=(s:unknown)=>String(s??'').replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
  const date=(s:unknown)=>new Date(String(s)).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//VYBE//Meetup//UK','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',
    'UID:'+p.id+'@restsva-ui.github.io','DTSTAMP:'+date(new Date().toISOString()),'DTSTART:'+date(p.starts_at),'DTEND:'+date(p.ends_at),
    'SUMMARY:'+escape(p.title),'LOCATION:'+escape(p.visibility==='private'?p.city:[p.venue_label,p.city].filter(Boolean).join(', ')),
    'DESCRIPTION:VYBE — деталі зустрічі доступні у додатку після схвалення.','URL:'+APP_URL+'?plan='+encodeURIComponent(p.id),
    'END:VEVENT','END:VCALENDAR'];
  // RFC 5545 counts UTF-8 octets; continuation lines reserve one byte for the space.
  const encoder=new TextEncoder();
  return lines.map(line=>{let out='',bytes=0;for(const char of line){const n=encoder.encode(char).length;if(bytes+n>75){out+='\r\n ';bytes=1;}out+=char;bytes+=n;}return out;}).join('\r\n')+'\r\n';
}
type Context={userId:string;telegramId:number;endpoint:string;rpc:(name:string,input:Record<string,unknown>)=>Promise<any>;telegram:(method:string,payload:Record<string,unknown>)=>Promise<any>};
export async function handlePlanGrowth(action:string,body:Record<string,any>,ctx:Context){
  if(action==='plans_invite_preview'?!validToken(body.token):!validToken(body.plan_id))return {status:400,data:{ok:false,error:'INVALID_PLAN'}};
  if(['plans_invite_update','plans_reminder_set'].includes(action)&&typeof body.enabled!=='boolean')return {status:400,data:{ok:false,error:'INVALID_PLAN'}};
  try{
    if(action==='plans_invite_preview'){
      const p=await ctx.rpc('vybe_plan_invite_preview',{p_token:body.token,p_viewer:ctx.userId});
      if(!p)throw new Error('PLAN_INVITE_UNAVAILABLE');
      return {status:200,data:{ok:true,plan:publicPreview(p)}};
    }
    const operation=action.slice(6), r=await ctx.rpc('vybe_plan_growth',{p_user:ctx.userId,p_action:operation,p_plan:body.plan_id,p_enabled:typeof body.enabled==='boolean'?body.enabled:null});
    if(action==='plans_calendar')return {status:200,data:{ok:true,url:ctx.endpoint+'?calendar='+encodeURIComponent(r.token),filename:'VYBE-meetup.ics'}};
    if(action==='plans_share'){
      const p=publicPreview(r.plan), url=APP_URL+'?invite='+encodeURIComponent(r.token), botUrl='https://t.me/vybe_now_bot?start=plan_'+r.token;
      const escape=(s:unknown)=>String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]!));
      const when=new Date(p.starts_at).toLocaleString('uk-UA',{timeZone:'Europe/Kyiv',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
      const shareText=`VYBE · ${p.title}\n${when} (Київський час)\n${p.city}${p.visibility==='public'?' · '+p.venue_label:''}\nЩе ${Math.max(0,Number(p.capacity)-Number(p.approved_count))} місць · Участь після схвалення`;
      let prepared: any=null;
      if(body.native===true){try{prepared=await ctx.telegram('savePreparedInlineMessage',{user_id:ctx.telegramId,allow_user_chats:true,allow_group_chats:true,allow_channel_chats:true,result:{type:'article',id:crypto.randomUUID(),title:String(p.title),description:shareText,url,input_message_content:{message_text:escape(shareText),parse_mode:'HTML',link_preview_options:{is_disabled:true}},reply_markup:{inline_keyboard:[[{text:'Переглянути план / View plan',url},{text:'VYBE у Telegram',url:botUrl}]]}}});}catch{/* A link remains usable if this Telegram client cannot use prepared messages. */}}
      return {status:200,data:{ok:true,url,bot_url:botUrl,text:shareText,prepared_id:prepared?.id||null}};
    }
    if(action.startsWith('plans_invite_'))return {status:200,data:{ok:true,enabled:r.enabled===true,plan:publicPreview(r.plan)}};
    return {status:200,data:{ok:true,enabled:r.enabled===true,delivered:r.delivered===true}};
  }catch(error){
    const message=error instanceof Error?error.message:'';
    const status=['PLAN_UNAVAILABLE','PLAN_JOIN_REQUIRED','PLAN_INVITE_UNAVAILABLE'].includes(message)?403:message==='PLAN_CLOSED'?409:message==='INVALID_PLAN'?400:503;
    return {status,data:{ok:false,error:status===503?'PLANS_UNAVAILABLE':message}};
  }
}
