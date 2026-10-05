// Optional native WebRTC integration test; no microphone, camera, TURN or real users.
// npm install --prefix /tmp/vybe-rtc-test @roamhq/wrtc@0.10.0 --no-audit --no-fund
// node scripts/test-webrtc-loopback.mjs /tmp/vybe-rtc-test
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const rtc=require(require.resolve('@roamhq/wrtc',{paths:[process.argv[2]||process.cwd()]}));
async function exercise(video){
 const a=new rtc.RTCPeerConnection({iceServers:[]}),b=new rtc.RTCPeerConnection({iceServers:[]});
 const queuedA=[],queuedB=[],sources=[],tracks=[],sinks=[];let audioPackets=0,videoFrames=0,pcm=false,candidates=0;
 a.onicecandidate=({candidate})=>{if(candidate)(b.remoteDescription?b.addIceCandidate(candidate):Promise.resolve(queuedB.push(candidate))).catch(()=>{})};
 b.onicecandidate=({candidate})=>{if(candidate)(a.remoteDescription?a.addIceCandidate(candidate):Promise.resolve(queuedA.push(candidate))).catch(()=>{})};
 b.ontrack=({track})=>{if(track.kind==='audio'){const sink=new rtc.nonstandard.RTCAudioSink(track);sink.ondata=e=>{audioPackets++;if(e.samples.some(x=>x!==0))pcm=true};sinks.push(sink)}else{const sink=new rtc.nonstandard.RTCVideoSink(track);sink.onframe=()=>videoFrames++;sinks.push(sink)}};
 const source=new rtc.nonstandard.RTCAudioSource(),audio=source.createTrack();sources.push(source);tracks.push(audio);a.addTrack(audio);
 let videoSource;
 if(video){videoSource=new rtc.nonstandard.RTCVideoSource();const track=videoSource.createTrack();tracks.push(track);a.addTrack(track)}
 let interval,timeout;
 try{
  await a.setLocalDescription(await a.createOffer());await b.setRemoteDescription(a.localDescription);
  while(queuedB.length)await b.addIceCandidate(queuedB.shift());
  await b.setLocalDescription(await b.createAnswer());await a.setRemoteDescription(b.localDescription);
  while(queuedA.length)await a.addIceCandidate(queuedA.shift());
  await new Promise((resolve,reject)=>{timeout=setTimeout(()=>reject(new Error('WebRTC connection timeout: '+a.connectionState+'/'+b.connectionState+'; ICE '+a.iceConnectionState+'/'+b.iceConnectionState+'; gathered '+a.iceGatheringState+'/'+b.iceGatheringState)),15000);const check=()=>{if(a.connectionState==='connected'&&b.connectionState==='connected'){clearTimeout(timeout);resolve()}};a.onconnectionstatechange=check;b.onconnectionstatechange=check;check()});
  let frame=0;
  interval=setInterval(()=>{const samples=new Int16Array(480);for(let i=0;i<480;i++)samples[i]=Math.sin((frame*480+i)*Math.PI*440/24000)*2000;
    source.onData({samples,sampleRate:48000,bitsPerSample:16,channelCount:1,numberOfFrames:480});
    if(videoSource&&frame%4===0)videoSource.onFrame({width:64,height:48,data:new Uint8ClampedArray(64*48*3/2).fill(128)});frame++;
  },10);
  await new Promise(resolve=>setTimeout(resolve,1400));
  assert.ok(audioPackets>20&&pcm,'Decoded nonzero audio must reach the second peer');
  if(video)assert.ok(videoFrames>5,'Decoded video frames must reach the second peer');
  const stats=await b.getStats();let receivedBytes=0;stats.forEach(s=>{if(s.type==='inbound-rtp')receivedBytes+=s.bytesReceived||0});assert.ok(receivedBytes>100);
  console.log(`${video?'Video + audio':'Voice'}: connected; ${audioPackets} decoded audio packets; ${videoFrames} decoded video frames; ${receivedBytes} received RTP bytes.`);
 }finally{clearInterval(interval);clearTimeout(timeout);sinks.forEach(s=>s.stop());tracks.forEach(t=>t.stop());a.close();b.close()}
}
try{await exercise(false);await exercise(true);console.log('Native WebRTC loopback integration passed.');process.exit(0)}catch(e){console.error(e.message);process.exit(1)}
