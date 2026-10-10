export const PLAN_ACTIONS = new Set(['plans_list','plans_my','plans_get','plans_create','plans_apply','plans_respond','plans_leave','plans_cancel','plans_message']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const categories = new Set(['pizza','pub','walk','celebration','party','outdoors','other']);
const text = (value: unknown, min: number, max: number) => typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;
const id = (value: unknown) => typeof value === 'string' && uuid.test(value);
const instant = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
type Context = {
  userId: string;
  rpc: (name: string, input: Record<string,unknown>) => Promise<any>;
  signPhotos: (values: Array<string|null|undefined>) => Promise<Map<string,string|null>>;
  notify: (notice: Record<string,any>) => Promise<unknown>;
};
export async function handlePlanAction(action: string, body: Record<string,any>, ctx: Context) {
  const operation = action.slice(6), input: Record<string,any> = {};
  const invalid = () => ({status:400,data:{ok:false,error:'INVALID_PLAN'}});
  if (operation === 'list') {
    if (body.category !== undefined && body.category !== '' && !categories.has(body.category)) return invalid();
    if (body.day !== undefined && !['all','24h','week'].includes(body.day)) return invalid();
    input.category = body.category || ''; input.day = body.day || 'all';
    if (body.starts_from !== undefined || body.starts_before !== undefined) {
      if (!instant(body.starts_from) || !instant(body.starts_before) || body.starts_from >= body.starts_before
        || Date.parse(body.starts_before)-Date.parse(body.starts_from) > 26*3600000 || input.day !== 'all') return invalid();
      input.starts_from = body.starts_from; input.starts_before = body.starts_before;
    }
    if (body.bounds !== undefined) {
      const b = body.bounds;
      if (!b || typeof b !== 'object' || !['south','north','west','east'].every(k => typeof b[k] === 'number' && Number.isFinite(b[k]))
        || b.south < -85 || b.north > 85 || b.south >= b.north || b.west < -180 || b.west > 180 || b.east < -180 || b.east > 180) return invalid();
      input.bounds = {south:b.south,north:b.north,west:b.west,east:b.east};
    }
  } else if (operation === 'create') {
    if (!id(body.client_nonce) || !categories.has(body.category) || !['public','private'].includes(body.visibility)
      || !text(body.title,3,80) || !text(body.description ?? '',0,500) || !text(body.city,1,64) || !text(body.venue_label,2,80) || !text(body.meeting_details,2,300)
      || !Number.isInteger(body.duration_hours) || body.duration_hours < 1 || body.duration_hours > 24
      || !Number.isInteger(body.capacity) || body.capacity < 2 || body.capacity > 20
      || typeof body.map_lat !== 'number' || !Number.isFinite(body.map_lat) || body.map_lat < -85 || body.map_lat > 85
      || typeof body.map_lng !== 'number' || !Number.isFinite(body.map_lng) || body.map_lng < -180 || body.map_lng > 180
      || typeof body.starts_at !== 'string' || !Number.isFinite(Date.parse(body.starts_at))) return invalid();
    for (const k of ['client_nonce','category','visibility','title','city','venue_label','meeting_details','duration_hours','capacity','map_lat','map_lng']) input[k] = typeof body[k] === 'string' ? body[k].trim() : body[k];
    input.description = (body.description || '').trim(); input.starts_at = new Date(body.starts_at).toISOString();
  } else if (operation !== 'my') {
    if (!id(body.plan_id)) return invalid();
    input.plan_id = body.plan_id;
    if (operation === 'apply') {
      if (!text(body.note ?? '',0,200)) return invalid(); input.note = (body.note || '').trim();
    } else if (operation === 'respond') {
      if (!id(body.user_id) || !['approved','rejected'].includes(body.decision)) return invalid();
      input.user_id = body.user_id; input.decision = body.decision;
    } else if (operation === 'message') {
      if (!id(body.client_nonce) || !text(body.body,1,1000)) return invalid();
      input.client_nonce = body.client_nonce; input.body = body.body.trim();
    }
  }
  try {
    const result = operation === 'list'
      ? await ctx.rpc('vybe_plan_list',{p_user:ctx.userId,p_input:input})
      : await ctx.rpc('vybe_plan',{p_user:ctx.userId,p_action:operation,p_input:input});
    const notices: Record<string,any>[] = result.notices || [];
    delete result.notices; // Internal recipient IDs and delivery keys never reach a client.
    const profiles: Record<string,any>[] = [];
    for (const plan of result.plans || []) if (plan.host) profiles.push(plan.host);
    if (result.plan?.host) profiles.push(result.plan.host);
    for (const member of result.members || []) profiles.push(member);
    for (const request of result.requests || []) if (request.profile) profiles.push(request.profile);
    for (const message of result.messages || []) if (message.sender) profiles.push(message.sender);
    const photos = await ctx.signPhotos(profiles.map(p=>p.photo_url));
    for (const profile of profiles) profile.photo_url = photos.get(String(profile.photo_url || '')) || null;
    await Promise.allSettled(notices.map(notice=>ctx.notify(notice)));
    return {status:200,data:result};
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const forbidden = ['PLAN_UNAVAILABLE','PLAN_PROFILE_REQUIRED','PLAN_JOIN_REQUIRED'];
    const conflict = ['PLAN_FULL','PLAN_CLOSED','PLAN_REQUEST_DECLINED','PLAN_REQUEST_MISSING','PLAN_LIMIT','PLAN_RETRY_CHANGED'];
    const bad = ['INVALID_PLAN','INVALID_PLAN_TIME'];
    const status = forbidden.includes(message) ? 403 : conflict.includes(message) ? 409 : bad.includes(message) ? 400 : 503;
    return {status,data:{ok:false,error:status===503?'PLANS_UNAVAILABLE':message}};
  }
}
