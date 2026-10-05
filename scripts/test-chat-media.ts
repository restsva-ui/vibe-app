import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {mediaPayload,callSignal,turnUrls,boundedJson} from '../supabase/functions/_shared/chat-media.ts';
import {handleMediaAction,flushMediaCleanup} from '../supabase/functions/_shared/chat-media-api.ts';
const user='11111111-1111-4111-8111-111111111111',match='44444444-4444-4444-8444-444444444444',id='55555555-5555-4555-8555-555555555555';
const bytes=new Uint8Array(64);bytes.set([0x1a,0x45,0xdf,0xa3]);
const input={kind:'voice',match_id:match,message_id:id,mime:'audio/webm;codecs=opus',duration_ms:1500,data:btoa(String.fromCharCode(...bytes))};
assert.equal(mediaPayload(input).mime,'audio/webm');
for(const patch of [{kind:'file'},{mime:'text/html'},{duration_ms:120001},{duration_ms:-1},{duration_ms:1.5},{match_id:'../../private'},{data:'<script>'},{data:btoa('not a media container'.repeat(4))}])assert.throws(()=>mediaPayload({...input,...patch}));
assert.equal(mediaPayload({...input,kind:'video',mime:'video/webm'}).kind,'video');
assert.throws(()=>mediaPayload({...input,kind:'video',mime:'video/webm',duration_ms:60001}));
assert.deepEqual(callSignal('offer',{type:'offer',sdp:'v=0\r\n',secret:'discard'}),{type:'offer',sdp:'v=0\r\n'});
for(const [kind,payload] of [['offer',{type:'answer',sdp:'v=0'}],['answer',{type:'answer',sdp:'x'}],['offer',{type:'offer',sdp:'v=0'+'x'.repeat(65536)}],['ice',{candidate:'<script>'}],['ice',{candidate:'candidate:abc',sdpMLineIndex:1.5}],['file',{}]])assert.throws(()=>callSignal(kind,payload));
assert.deepEqual(turnUrls('turn:relay.example:3478?transport=udp,turns:relay.example:5349'),['turn:relay.example:3478?transport=udp','turns:relay.example:5349']);
assert.throws(()=>turnUrls('https://attacker.example'));assert.throws(()=>turnUrls('turn:user:secret@relay.example'));
let uploads=0,notified=0,deletes=0;const queue=new Set<string>();const events:string[]=[];
const ctx={userId:user,env:(name:string)=>name==='SUPABASE_URL'?'https://project.supabase.co':undefined,
 rpc:async(name:string)=>{events.push(name);if(name==='vybe_chat_peer')return user;if(name==='vybe_send_media')return {created:true,peer_id:user};return {ok:true,call:{id,state:'accepted',match_id:match,media_kind:'audio'},peer_id:user,signals:[]}},
 db:async(path:string,options?:RequestInit)=>{if(path==='chat_media_cleanup'&&options?.method==='POST')queue.add(JSON.parse(String(options.body)).object_path);if(path.includes('chat_media_cleanup?')&&options?.method==='DELETE')deletes++;if(path.startsWith('chat_media_cleanup?')&&!options)return [];if(path.includes('select=media_path'))return [{media_path:user+'/'+match+'/record.webm'}];return []},
 storage:async(path:string,options?:RequestInit)=>{if(options?.method==='POST'&&path.startsWith('object/chat-media/')){uploads++;assert.ok(events.includes('vybe_chat_peer'));return new Response('{}')}if(path.includes('object/sign/'))return new Response(JSON.stringify({signedURL:'/object/sign/chat-media/record.webm?token=qa'}));return new Response('{}')},
 notify:async()=>{notified++},
};
assert.equal((await handleMediaAction('message_media_send',input,ctx)).data.ok,true);assert.equal(uploads,1);assert.equal(notified,1);
const denied={...ctx,rpc:async()=>{throw new Error('CHAT_UNAVAILABLE')}};
assert.equal((await handleMediaAction('message_media_send',input,denied)).status,403);assert.equal(uploads,1);
assert.equal((await handleMediaAction('message_media_url',{match_id:match,message_id:id},denied)).status,403);
const url=await handleMediaAction('message_media_url',{match_id:match,message_id:id},ctx);
assert.equal(url.data.url,'https://project.supabase.co/storage/v1/object/sign/chat-media/record.webm?token=qa');assert.equal(url.data.expires_in,180);
const malformed=await handleMediaAction('call_signal',{call_id:id,kind:'offer',payload:{type:'offer',sdp:'no'}},ctx);assert.equal(malformed.status,400);
const direct=await handleMediaAction('rtc_config',{call_id:id},ctx);assert.equal(direct.data.relay_available,false);assert.equal(direct.data.iceTransportPolicy,'all');
const relay=await handleMediaAction('rtc_config',{call_id:id},{...ctx,env:(name:string)=>({TURN_URLS:'turn:relay.example:3478',TURN_SHARED_SECRET:'server-only-test-secret'}[name])});
assert.equal(relay.data.relay_available,true);assert.equal(relay.data.iceTransportPolicy,'relay');assert.ok(relay.data.iceServers[0].credential);assert.ok(!JSON.stringify(relay.data).includes('server-only-test-secret'));
const partial=await handleMediaAction('rtc_config',{call_id:id},{...ctx,env:(name:string)=>name==='TURN_SHARED_SECRET'?'secret':undefined});assert.equal(partial.data.error,'TURN_UNAVAILABLE');
await flushMediaCleanup(ctx);assert.equal(deletes,0);
console.log('Media validation, protected URLs, authorization-before-upload, signaling limits and ephemeral TURN checks passed.');

const browserScope={window:{}};vm.runInNewContext(fs.readFileSync("chat-media.js","utf8"),browserScope);
const encoding=(browserScope.window as any).VybeMedia.base64DataUrl;
assert.equal(encoding("data:video/webm;codecs=vp8,opus;base64,QUJDRA=="),"QUJDRA==");
assert.equal(encoding("data:audio/webm;codecs=opus;base64,QUJDRA=="),"QUJDRA==");
assert.throws(()=>encoding("not base64 media"));
assert.deepEqual(await boundedJson(new Request("https://example.test",{method:"POST",body:'{"ok":true}'})),{ok:true});
await assert.rejects(()=>boundedJson(new Request("https://example.test",{method:"POST",body:"1234567890"}),5),/BODY_TOO_LARGE/);
console.log("Video codec comma regression and chunked request size boundaries passed.");
