import { callSignal, mediaPayload, turnUrls, UUID_RE } from './chat-media.ts';
type Context = {
  userId: string;
  db: (path: string, options?: RequestInit) => Promise<any>;
  rpc: (name: string, payload: Record<string, unknown>) => Promise<any>;
  storage: (path: string, options?: RequestInit) => Promise<Response>;
  env: (name: string) => string | undefined;
  notify: (peer: string, match: string, key: string, variant?: 'call_audio' | 'call_video') => Promise<unknown>;
};
const enc = (path: string) => path.split('/').map(encodeURIComponent).join('/');
const bucket = 'chat-media';
export const MEDIA_ACTIONS = new Set(['message_media_send','message_media_url','call_start','call_action','call_poll','call_signal','rtc_config']);
export async function flushMediaCleanup(ctx: Pick<Context, 'db' | 'storage'>) {
  try {
    const rows = await ctx.db(`chat_media_cleanup?delete_after=lte.${encodeURIComponent(new Date().toISOString())}&select=object_path&limit=30`);
    let allClean=true;
    for (const row of rows || []) {
      // A retried request may have committed after its HTTP response was lost.
      const used = await ctx.db(`messages?media_path=eq.${encodeURIComponent(row.object_path)}&select=id&limit=1`);
      if (!used?.length) {
        const r = await ctx.storage(`object/${bucket}`, {method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:[row.object_path]})});
        if (!r.ok) {allClean=false;continue;}
      }
      await ctx.db(`chat_media_cleanup?object_path=eq.${encodeURIComponent(row.object_path)}`, {method:'DELETE'});
    }
    return allClean;
  } catch { return false; }
}
async function rtcConfig(ctx: Context) {
  const ttl = 3600;
  const keyId = ctx.env('CF_TURN_KEY_ID'), token = ctx.env('CF_TURN_API_TOKEN');
  if (keyId || token) {
    if (!keyId || !token || !/^[a-zA-Z0-9_-]+$/.test(keyId)) throw new Error('TURN_UNAVAILABLE');
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`, {
      method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({ttl}),signal:AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error('TURN_UNAVAILABLE');
    const data = await r.json();
    if (!Array.isArray(data.iceServers) || !data.iceServers.some((x: any) => x.credential && x.username)) throw new Error('TURN_UNAVAILABLE');
    return {iceServers:data.iceServers,iceTransportPolicy:'relay',relay_available:true,expires_in:ttl};
  }
  const secret = ctx.env('TURN_SHARED_SECRET'), urls = ctx.env('TURN_URLS');
  if (secret || urls) {
    if (!secret || !urls) throw new Error('TURN_UNAVAILABLE');
    const username = `${Math.floor(Date.now()/1000)+ttl}:${ctx.userId}`;
    const key = await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-1'},false,['sign']);
    const signature = new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(username)));
    const credential = btoa(String.fromCharCode(...signature));
    return {iceServers:[{urls:turnUrls(urls),username,credential}],iceTransportPolicy:'relay',relay_available:true,expires_in:ttl};
  }
  return {iceServers:[{urls:'stun:stun.cloudflare.com:3478'}],iceTransportPolicy:'all',relay_available:false,expires_in:ttl};
}
export async function handleMediaAction(action: string, body: Record<string, unknown>, ctx: Context): Promise<{data: any; status: number}> {
  try {
    if (action === 'message_media_send') {
      const media = mediaPayload(body), match = String(body.match_id), id = String(body.message_id);
      await ctx.rpc('vybe_chat_peer',{p_user:ctx.userId,p_match:match});
      const existing = await ctx.db(`messages?id=eq.${id}&sender_id=eq.${ctx.userId}&match_id=eq.${match}&kind=eq.${media.kind}&select=id&limit=1`);
      if (existing?.length) return {status:200,data:{ok:true,message_id:id}};
      const path = `${ctx.userId}/${match}/${crypto.randomUUID()}.${media.ext}`;
      await ctx.db('chat_media_cleanup',{method:'POST',body:JSON.stringify({object_path:path,delete_after:new Date(Date.now()+15*60000).toISOString()})});
      try {
        const upload = await ctx.storage(`object/${bucket}/${enc(path)}`,{method:'POST',headers:{'Content-Type':media.mime,'Cache-Control':'private, max-age=0','x-upsert':'false'},body:media.bytes});
        if (!upload.ok) throw new Error('MEDIA_UPLOAD_FAILED');
        const result = await ctx.rpc('vybe_send_media',{p_user:ctx.userId,p_match:match,p_id:id,p_kind:media.kind,p_path:path,p_mime:media.mime,p_duration:media.duration,p_bytes:media.bytes.length});
        if (!result.created) await ctx.db(`chat_media_cleanup?object_path=eq.${encodeURIComponent(path)}`,{method:'PATCH',body:JSON.stringify({delete_after:new Date().toISOString()})});
        if (result.created) await ctx.notify(String(result.peer_id),match,`message:${id}`);
        await flushMediaCleanup(ctx);
        return {status:200,data:{ok:true,message_id:id}};
      } catch (e) {
        await ctx.db(`chat_media_cleanup?object_path=eq.${encodeURIComponent(path)}`,{method:'PATCH',body:JSON.stringify({delete_after:new Date().toISOString()})}).catch(()=>{});
        await flushMediaCleanup(ctx);
        throw e;
      }
    }
    if (action === 'message_media_url') {
      if (!UUID_RE.test(String(body.message_id)) || !UUID_RE.test(String(body.match_id))) throw new Error('INVALID_ID');
      await ctx.rpc('vybe_chat_peer',{p_user:ctx.userId,p_match:body.match_id});
      const rows = await ctx.db(`messages?id=eq.${body.message_id}&match_id=eq.${body.match_id}&kind=in.(voice,video)&select=media_path&limit=1`);
      if (!rows?.[0]?.media_path) return {status:404,data:{ok:false,error:'MEDIA_UNAVAILABLE'}};
      const signed = await ctx.storage(`object/sign/${bucket}/${enc(rows[0].media_path)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expiresIn:180})});
      if (!signed.ok) throw new Error('MEDIA_UNAVAILABLE');
      const result = await signed.json();
      const relative=String(result.signedURL||'');
      if (!relative.startsWith('/object/sign/chat-media/')) throw new Error('MEDIA_UNAVAILABLE');
      const url = new URL(`${ctx.env('SUPABASE_URL')}/storage/v1${relative}`);
      return {status:200,data:{ok:true,url:url.href,expires_in:180}};
    }
    const callId = body.call_id == null ? '' : String(body.call_id);
    if (callId && !UUID_RE.test(callId)) throw new Error('INVALID_ID');
    if (action !== 'call_start' && action !== 'call_poll' && !callId) throw new Error('INVALID_ID');
    let operation = 'poll', input: Record<string, unknown> = {call_id:callId};
    if (action === 'call_start') {
      if (!UUID_RE.test(String(body.match_id)) || !['audio','video'].includes(String(body.media_kind))) throw new Error('INVALID_CALL');
      operation='start'; input={match_id:body.match_id,media_kind:body.media_kind};
    } else if (action === 'call_action') {
      if (!['accept','reject','end'].includes(String(body.operation))) throw new Error('INVALID_CALL');
      operation=String(body.operation);
    } else if (action === 'call_signal') {
      operation='signal'; input={...input,kind:body.kind,payload:callSignal(body.kind,body.payload)};
    } else if (action === 'rtc_config') operation='config';
    else {
      const cursor=Number(body.cursor || 0);
      if (!Number.isSafeInteger(cursor) || cursor<0) throw new Error('INVALID_CURSOR');
      input.cursor=cursor;
    }
    const result=await ctx.rpc('vybe_call',{p_user:ctx.userId,p_action:operation,p_input:input});
    if (!result.ok) return {status:409,data:result};
    if (action === 'rtc_config') {
      if (!['ringing','accepted'].includes(result.call?.state)) return {status:409,data:{ok:false,error:'CALL_EXPIRED'}};
      return {status:200,data:{ok:true,...await rtcConfig(ctx)}};
    }
    if (result.call && ['call_start','call_poll'].includes(action)) {
      const peers=await ctx.db(`profiles?user_id=eq.${result.peer_id}&select=name&limit=1`);
      result.peer_name=peers?.[0]?.name || 'VYBE';
    }
    if (action==='call_start') await ctx.notify(String(result.peer_id),String(result.call.match_id),`call:${result.call.id}`,result.call.media_kind==='video'?'call_video':'call_audio');
    return {status:200,data:result};
  } catch (e) {
    const message=String(e instanceof Error?e.message:e);
    const known=['CHAT_UNAVAILABLE','CALL_UNAVAILABLE','CALL_FORBIDDEN','CALL_EXPIRED','SIGNAL_LIMIT','MEDIA_TOO_LARGE','MEDIA_UNAVAILABLE','MEDIA_UPLOAD_FAILED','TURN_UNAVAILABLE'];
    const error=known.find(x=>message.includes(x)) || (message.startsWith('INVALID_')?message:'MEDIA_REQUEST_FAILED');
    return {status:error.includes('UNAVAILABLE')||error.includes('FORBIDDEN')?403:error==='MEDIA_TOO_LARGE'?413:error==='MEDIA_REQUEST_FAILED'||error==='MEDIA_UPLOAD_FAILED'?503:400,data:{ok:false,error}};
  }
}
