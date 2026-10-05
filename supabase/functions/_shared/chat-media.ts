// Media payloads and signaling are untrusted even after Telegram authentication.
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const MEDIA_LIMITS = {
  voice: { bytes: 4 * 1024 * 1024, duration: 120000 },
  video: { bytes: 12 * 1024 * 1024, duration: 60000 },
} as const;
export async function boundedJson(request: Request, limit = 18000000) {
  if (!request.body) throw new Error('INVALID_JSON');
  const reader=request.body.getReader(), chunks: Uint8Array[]=[];let size=0;
  while (true) {
    const {done,value}=await reader.read();if(done)break;
    size+=value.byteLength;
    if(size>limit){await reader.cancel();throw new Error('BODY_TOO_LARGE');}
    chunks.push(value);
  }
  const bytes=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return JSON.parse(new TextDecoder().decode(bytes));
}
export function mediaPayload(input: Record<string, unknown>) {
  const kind = input.kind;
  if (kind !== 'voice' && kind !== 'video') throw new Error('INVALID_MEDIA');
  if (!UUID_RE.test(String(input.match_id)) || !UUID_RE.test(String(input.message_id))) throw new Error('INVALID_ID');
  const duration = Number(input.duration_ms);
  if (!Number.isInteger(duration) || duration < 250 || duration > MEDIA_LIMITS[kind].duration) throw new Error('INVALID_DURATION');
  const mime = String(input.mime || '').split(';')[0].toLowerCase();
  const allowed = kind === 'voice' ? ['audio/webm', 'audio/ogg', 'audio/mp4'] : ['video/webm', 'video/mp4'];
  if (!allowed.includes(mime)) throw new Error('INVALID_MEDIA_TYPE');
  const data = input.data;
  if (typeof data !== 'string' || data.length > Math.ceil(MEDIA_LIMITS[kind].bytes / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw new Error('MEDIA_TOO_LARGE');
  let raw: string;
  try { raw = atob(data); } catch { throw new Error('INVALID_MEDIA'); }
  const bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
  if (bytes.length < 32 || bytes.length > MEDIA_LIMITS[kind].bytes) throw new Error('MEDIA_TOO_LARGE');
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  const container = mime.endsWith('/webm') ? bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3
    : mime.endsWith('/ogg') ? ascii(0, 4) === 'OggS' : ascii(4, 8) === 'ftyp';
  if (!container) throw new Error('INVALID_MEDIA_CONTAINER');
  // This validates the container, not decoded duration/codecs; byte and time quotas bound uploads.
  return { kind, mime, duration, bytes, ext: mime.endsWith('/mp4') ? 'mp4' : mime.endsWith('/ogg') ? 'ogg' : 'webm' };
}
export function callSignal(kind: unknown, value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_SIGNAL');
  const p = value as Record<string, unknown>;
  if (kind === 'offer' || kind === 'answer') {
    if (p.type !== kind || typeof p.sdp !== 'string' || p.sdp.length > 65536 || !p.sdp.startsWith('v=0')) throw new Error('INVALID_SDP');
    return { type: kind, sdp: p.sdp };
  }
  if (kind === 'ice') {
    if (typeof p.candidate !== 'string' || p.candidate.length > 2048 || !p.candidate.startsWith('candidate:')) throw new Error('INVALID_ICE');
    if (p.sdpMid != null && (typeof p.sdpMid !== 'string' || p.sdpMid.length > 32)) throw new Error('INVALID_ICE');
    if (p.sdpMLineIndex != null && (!Number.isInteger(p.sdpMLineIndex) || Number(p.sdpMLineIndex) < 0 || Number(p.sdpMLineIndex) > 8)) throw new Error('INVALID_ICE');
    return { candidate: p.candidate, sdpMid: p.sdpMid ?? null, sdpMLineIndex: p.sdpMLineIndex ?? null };
  }
  throw new Error('INVALID_SIGNAL');
}
export function turnUrls(value: string) {
  const urls = value.split(',').map(x => x.trim()).filter(Boolean);
  if (!urls.length || urls.length > 8 || urls.some(x => !/^turns?:[a-z0-9.-]+(?::\d{1,5})?(?:\?transport=(?:udp|tcp))?$/i.test(x))) throw new Error('INVALID_TURN_CONFIG');
  return urls;
}
