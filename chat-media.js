/* Voice/video recording and WebRTC calls. No credentials or recordings in localStorage. */
window.VybeMedia={base64DataUrl(value){const marker=String(value).indexOf(';base64,');if(marker<0)throw new Error('Invalid recording');return String(value).slice(marker+8)},create(config){
  const api=config.api, esc=config.escape, $=id=>document.getElementById(id);
  const t=(uk,en)=>config.language()==='en'?en:uk;
  const limits={voice:{duration:120000,bytes:4*1024*1024},video:{duration:60000,bytes:12*1024*1024}};
  const paths={mic:'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3ZM6 10v2a6 6 0 0 0 12 0v-2M12 18v3M9 21h6',video:'M15 8l6-3v14l-6-3M3 5h12v14H3z',phone:'M7 3l3 5-3 3a16 16 0 0 0 6 6l3-3 5 3c0 3-2 4-4 4C9 21 3 15 3 7c0-2 1-4 4-4Z',stop:'M6 6h12v12H6z',close:'M5 5l14 14M19 5L5 19',send:'M3 3l18 9-18 9 4-9-4-9ZM7 12h14'};
  const icon=name=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+`<path d="${paths[name]||paths.phone}"/>`+'</svg>';
  const uuid=()=>{if(crypto.randomUUID)return crypto.randomUUID();const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20)};
  const time=ms=>{const s=Math.max(0,Math.floor(ms/1000));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
  let recording=null,recordEpoch=0,call=null,callStarting=false,callEpoch=0,polling=false,pollTimer=null,started=false;
  const tracksOff=stream=>stream?.getTracks().forEach(track=>track.stop());
  const active=()=>config.userId()&&config.allowed();
  const alert=(uk,en)=>config.alert(t(uk,en));
  function permissionError(e,video=false){
    if(e?.name==='NotAllowedError'||e?.name==='SecurityError')alert(video?'Дозволь доступ до мікрофона й камери в налаштуваннях Telegram або браузера.':'Дозволь доступ до мікрофона в налаштуваннях Telegram або браузера.',video?'Allow microphone and camera access in Telegram or browser settings.':'Allow microphone access in Telegram or browser settings.');
    else if(e?.name==='NotFoundError')alert('Мікрофон або камера недоступні на цьому пристрої.','A microphone or camera is unavailable on this device.');
    else alert('Не вдалося відкрити мікрофон або камеру. Закрий інші програми, що їх використовують, і спробуй ще раз.','Could not open the microphone or camera. Close other apps using them and try again.');
  }
  async function capture(video){
    if(!navigator.mediaDevices?.getUserMedia){const e=new Error('Media unavailable');e.name='NotFoundError';throw e}
    return navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:video?{width:{ideal:480,max:640},height:{ideal:640,max:640},frameRate:{ideal:15,max:20},facingMode:'user'}:false});
  }
  function disposeRecording(){
    recordEpoch++;
    const r=recording;recording=null;
    if(!r)return;
    clearInterval(r.timer);clearTimeout(r.autoStop);
    if(r.recorder?.state==='recording')try{r.recorder.stop()}catch{}
    tracksOff(r.stream);if(r.url)URL.revokeObjectURL(r.url);
    if(r.preview){r.preview.pause();r.preview.srcObject=null;r.preview.removeAttribute('src')}
    $('mediaDraft')?.remove();document.querySelectorAll('[data-record]').forEach(b=>b.disabled=false);
  }
  function stopRecording(){
    const r=recording;if(!r||r.state!=='recording')return;
    r.duration=Math.min(limits[r.kind].duration,Math.max(250,Date.now()-r.start));r.state='stopping';
    clearInterval(r.timer);clearTimeout(r.autoStop);
    try{r.recorder.stop()}catch{disposeRecording();alert('Не вдалося завершити запис. Спробуй ще раз.','Could not finish recording. Please try again.')}
    tracksOff(r.stream);
  }
  function drawDraft(){
    const r=recording,root=$('mediaDraft');if(!r||!root)return;
    const isVideo=r.kind==='video';
    if(r.state==='requesting'){
      root.innerHTML='<div class="recordStatus" role="status">'+t('Чекаємо дозволу…','Waiting for permission…')+'</div><button type="button" data-cancel aria-label="'+t('Скасувати','Cancel')+'">'+icon('close')+'</button>';
    }else if(r.state==='recording'){
      root.innerHTML='<div class="recordStatus" role="status"><span class="recordDot"></span><b id="recordClock">0:00</b><small>'+t('до ','up to ')+time(limits[r.kind].duration)+'</small></div>'+(isVideo?'<video id="recordPreview" class="recordPreview" autoplay muted playsinline></video>':'')+'<button type="button" data-stop>'+icon('stop')+'<span>'+t('Зупинити','Stop')+'</span></button><button type="button" data-cancel aria-label="'+t('Скасувати','Cancel')+'">'+icon('close')+'</button>';
      if(isVideo){r.preview=$('recordPreview');r.preview.srcObject=r.stream;r.preview.play().catch(()=>{})}
    }else if(r.state==='draft'||r.state==='sending'){
      root.innerHTML='<div class="draftCaption">'+t(isVideo?'Відеоповідомлення':'Голосове повідомлення',isVideo?'Video message':'Voice message')+' · '+time(r.duration)+'</div><'+(isVideo?'video':'audio')+' class="draftPlayer" controls playsinline preload="metadata"></'+(isVideo?'video':'audio')+'><div class="draftActions"><button type="button" data-cancel>'+t('Скасувати','Cancel')+'</button><button type="button" data-send class="primary">'+icon('send')+t(r.state==='sending'?'Надсилаємо…':'Надіслати',r.state==='sending'?'Sending…':'Send')+'</button></div>';
      r.preview=root.querySelector('.draftPlayer');r.preview.src=r.url;
      if(r.state==='sending')root.querySelectorAll('button').forEach(b=>b.disabled=true);
    }
    root.querySelector('[data-cancel]')?.addEventListener('click',disposeRecording);
    root.querySelector('[data-stop]')?.addEventListener('click',stopRecording);
    root.querySelector('[data-send]')?.addEventListener('click',sendRecording);
  }
  async function record(kind){
    if(recording||call||callStarting){alert('Заверши поточний запис або дзвінок.','Finish the current recording or call first.');return}
    if(!window.MediaRecorder){alert('Запис недоступний у цій версії Telegram. Онови Telegram або відкрий VYBE у сучасному браузері.','Recording is unavailable in this Telegram version. Update Telegram or use a current browser.');return}
    const chat=config.chat();if(!chat||!active())return;
    document.querySelectorAll('audio,video').forEach(p=>p.pause());
    const epoch=++recordEpoch;
    recording={epoch,kind,matchId:chat.matchId,state:'requesting',messageId:uuid(),chunks:[]};
    const root=document.createElement('div');root.id='mediaDraft';root.className='mediaShell mediaDraft';$('chatComposerTools')?.before(root);
    document.querySelectorAll('[data-record]').forEach(b=>b.disabled=true);drawDraft();
    try{
      const stream=await capture(kind==='video');
      if(!recording||recording.epoch!==epoch||config.chat()?.matchId!==chat.matchId){tracksOff(stream);return}
      const r=recording;r.stream=stream;
      const types=kind==='video'?['video/webm;codecs=vp8,opus','video/mp4','video/webm']:['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus','audio/webm'];
      const mime=types.find(x=>MediaRecorder.isTypeSupported(x));
      if(!mime)throw new Error('Unsupported recording format');
      r.recorder=new MediaRecorder(stream,{mimeType:mime,audioBitsPerSecond:48000,...(kind==='video'?{videoBitsPerSecond:600000}:{})});
      r.recorder.ondataavailable=e=>{if(e.data?.size)r.chunks.push(e.data);if(r.chunks.reduce((sum,b)=>sum+b.size,0)>limits[kind].bytes)stopRecording()};
      r.recorder.onerror=()=>{if(recording===r){disposeRecording();alert('Помилка запису. Спробуй ще раз.','Recording failed. Please try again.')}};
      r.recorder.onstop=()=>{
        tracksOff(stream);if(recording!==r)return;
        r.blob=new Blob(r.chunks,{type:r.recorder.mimeType||mime});r.chunks=[];
        if(!r.blob.size||r.blob.size>limits[kind].bytes){disposeRecording();alert('Запис завеликий або порожній. Запиши коротше повідомлення.','Recording is too large or empty. Try a shorter message.');return}
        r.url=URL.createObjectURL(r.blob);r.state='draft';drawDraft();
      };
      r.recorder.start(500);r.start=Date.now();r.state='recording';drawDraft();
      r.timer=setInterval(()=>{if($('recordClock'))$('recordClock').textContent=time(Date.now()-r.start)},250);
      r.autoStop=setTimeout(stopRecording,limits[kind].duration);
    }catch(e){if(recording?.epoch===epoch){disposeRecording();permissionError(e,kind==='video')}}
  }
  async function sendRecording(){
    const r=recording;if(!r||r.state!=='draft')return;
    r.state='sending';drawDraft();
    try{
      const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>{try{resolve(window.VybeMedia.base64DataUrl(reader.result))}catch(e){reject(e)}};reader.onerror=reject;reader.readAsDataURL(r.blob)});
      const result=await api('message_media_send',{match_id:r.matchId,message_id:r.messageId,kind:r.kind,mime:r.blob.type,duration_ms:r.duration,data});
      if(!result.ok)throw new Error(result.error);
      if(recording===r)disposeRecording();
      if(config.chat()?.matchId===r.matchId)await config.refreshChat();
    }catch{if(recording===r){r.state='draft';drawDraft()}alert('Не вдалося надіслати запис. Він збережений у чаті для повторної спроби.','Could not send the recording. It is still here for you to retry.')}
  }
  function messageMarkup(m){
    const label=t(m.kind==='video'?'Відеоповідомлення':'Голосове повідомлення',m.kind==='video'?'Video message':'Voice message');
    return '<div class="mediaShell messageMedia" data-media-id="'+esc(m.id)+'" data-media-kind="'+esc(m.kind)+'"><button type="button" class="mediaLoad">'+icon(m.kind==='video'?'video':'mic')+'<span>'+label+'<small>'+time(Number(m.duration_ms))+'</small></span><b aria-hidden="true">▶</b></button></div>';
  }
  function bindMessages(root,matchId){
    root.querySelectorAll('.messageMedia').forEach(box=>{
      const button=box.querySelector('.mediaLoad');if(!button||button.dataset.bound)return;button.dataset.bound='1';
      button.onclick=async()=>{
        button.disabled=true;
        const r=await api('message_media_url',{match_id:matchId,message_id:box.dataset.mediaId});
        if(!r.ok){button.disabled=false;alert('Запис недоступний. Перевір з’єднання та спробуй ще раз.','Recording unavailable. Check your connection and try again.');return}
        if(!box.isConnected)return;
        const video=box.dataset.mediaKind==='video',player=document.createElement(video?'video':'audio');
        player.controls=true;player.preload='metadata';player.setAttribute('playsinline','');player.className='messagePlayer';
        player.onplay=()=>document.querySelectorAll('audio,video').forEach(p=>{if(p!==player&&!p.closest('#vybeCall'))p.pause()});
        player.onerror=()=>{player.pause();player.remove();button.hidden=false;button.disabled=false;alert('Не вдалося відтворити запис. Натисни ще раз, щоб оновити доступ.','Could not play the recording. Tap again to refresh access.')};
        player.src=r.url;button.hidden=true;box.append(player);player.play().catch(()=>{});
      };
    });
  }
  function mount(){
    const chat=config.chat();if(!chat)return;
    if(recording&&recording.matchId!==chat.matchId)disposeRecording();
    if(!$('chatComposerTools')){
      const tools=document.createElement('div');tools.id='chatComposerTools';tools.className='mediaShell chatComposerTools';
      tools.innerHTML='<span>'+t('Повідомлення','Messages')+'</span><button type="button" data-record="voice" aria-label="'+t('Записати голосове повідомлення','Record a voice message')+'">'+icon('mic')+'<span>'+t('Голос','Voice')+'</span></button><button type="button" data-record="video" aria-label="'+t('Записати відеоповідомлення','Record a video message')+'">'+icon('video')+'<span>'+t('Відео','Video')+'</span></button>';
      document.querySelector('.chatComposer')?.before(tools);tools.querySelectorAll('[data-record]').forEach(b=>b.onclick=()=>record(b.dataset.record));
      const actions=document.createElement('div');actions.className='mediaShell chatCallActions';
      actions.innerHTML='<button type="button" data-call="audio" aria-label="'+t('Голосовий дзвінок','Voice call')+'">'+icon('phone')+'</button><button type="button" data-call="video" aria-label="'+t('Відеодзвінок','Video call')+'">'+icon('video')+'</button>';
      $('chatSafetyBtn')?.before(actions);actions.querySelectorAll('[data-call]').forEach(b=>b.onclick=()=>startCall(b.dataset.call));
    }
    bindMessages($('chatMessages'),chat.matchId);
  }
  function renderCall(){
    const c=call;if(!c)return;
    let root=$('vybeCall');if(!root){root=document.createElement('div');root.id='vybeCall';root.className='mediaShell callOverlay';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');document.body.append(root)}
    const incoming=c.data.state==='ringing'&&c.data.callee_id===config.userId();
    const video=c.data.media_kind==='video';
    root.innerHTML='<div class="callPanel"><div class="callHeading"><span>'+t(video?'Відеодзвінок':'Голосовий дзвінок',video?'Video call':'Voice call')+'</span><h2 class="userNameNoI18n">'+esc(c.name||'VYBE')+'</h2><p id="callStatus" role="status"></p></div><div class="callStage '+(video?'withVideo':'')+'"><div class="callAvatar">'+icon(video?'video':'phone')+'</div><video id="callRemoteVideo" autoplay playsinline></video><video id="callLocalVideo" autoplay muted playsinline></video></div><audio id="callRemoteAudio" autoplay></audio><button type="button" id="callPlay" hidden>'+t('Увімкнути звук','Enable audio')+'</button><p class="callPrivacy">'+t('Дзвінок не записується. Максимум 30 хвилин.','Calls are not recorded. Maximum 30 minutes.')+'</p><div class="callButtons">'+(incoming?'<button type="button" id="callReject" class="callHangup">'+icon('close')+'<span>'+t('Відхилити','Decline')+'</span></button><button type="button" id="callAccept" class="callAccept">'+icon('phone')+'<span>'+t('Відповісти','Answer')+'</span></button>':'<button type="button" id="callMute">'+icon('mic')+'<span>'+t('Мікрофон','Microphone')+'</span></button>'+(video?'<button type="button" id="callCamera">'+icon('video')+'<span>'+t('Камера','Camera')+'</span></button>':'')+'<button type="button" id="callEnd" class="callHangup">'+icon('phone')+'<span>'+t('Завершити','End')+'</span></button>')+'</div><small id="callNetwork"></small></div>';
    root.setAttribute('aria-label',t(video?'Відеодзвінок':'Голосовий дзвінок',video?'Video call':'Voice call'));
    if(c.stream&&video){$('callLocalVideo').srcObject=c.stream;$('callLocalVideo').play().catch(()=>{})}
    if(c.remote)attachRemote(c);
    $('callAccept')?.addEventListener('click',acceptCall);$('callReject')?.addEventListener('click',()=>endCall('reject'));
    $('callEnd')?.addEventListener('click',()=>endCall('end'));
    $('callMute')?.addEventListener('click',()=>{c.muted=!c.muted;c.stream?.getAudioTracks().forEach(x=>x.enabled=!c.muted);$('callMute').classList.toggle('isOff',c.muted);$('callMute').setAttribute('aria-pressed',String(c.muted))});
    $('callCamera')?.addEventListener('click',()=>{c.cameraOff=!c.cameraOff;c.stream?.getVideoTracks().forEach(x=>x.enabled=!c.cameraOff);$('callCamera').classList.toggle('isOff',c.cameraOff);$('callCamera').setAttribute('aria-pressed',String(c.cameraOff))});
    $('callPlay').onclick=()=>{const player=video?$('callRemoteVideo'):$('callRemoteAudio');player.play().then(()=>$('callPlay').hidden=true).catch(()=>{})};
    updateCallStatus();
  }
  function updateCallStatus(){
    const c=call;if(!c)return;
    const state=c.data.state;
    let label=state==='ringing'?(c.data.callee_id===config.userId()?t('Вхідний дзвінок','Incoming call'):t('Очікуємо відповіді…','Waiting for an answer…')):c.connected?time(Date.now()-c.connected):t('З’єднуємо…','Connecting…');
    if(c.accepting)label=t('Чекаємо дозволу…','Waiting for permission…');
    if(c.pc?.connectionState==='disconnected')label=t('Відновлюємо з’єднання…','Reconnecting…');
    if($('callStatus'))$('callStatus').textContent=label;
  }
  function attachRemote(c){
    if(!c.remote)return;
    const player=c.data.media_kind==='video'?$('callRemoteVideo'):$('callRemoteAudio');
    if(!player)return;player.srcObject=c.remote;
    if(c.data.media_kind==='video')$('vybeCall')?.classList.add('hasRemoteVideo');
    player.play().catch(()=>{if(call===c&&$('callPlay'))$('callPlay').hidden=false});
  }
  function clearCall(){
    const c=call;call=null;
    if(c){clearInterval(c.clock);clearTimeout(c.connectTimeout);clearTimeout(c.disconnectTimeout);tracksOff(c.stream);tracksOff(c.remote);try{c.pc?.close()}catch{}}
    $('vybeCall')?.querySelectorAll('audio,video').forEach(p=>{p.pause();p.srcObject=null});$('vybeCall')?.remove();
    if(started)schedulePoll(1000);
  }
  async function endCall(operation='end',notice=null){
    const c=call;if(!c)return;const id=c.data.id;clearCall();
    await api('call_action',{call_id:id,operation});if(notice)config.alert(notice);
  }
  async function startCall(kind){
    if(call||callStarting||recording){alert('Заверши поточний запис або дзвінок.','Finish the current recording or call first.');return}
    const chat=config.chat();if(!chat||!active())return;
    if(!window.RTCPeerConnection){alert('Дзвінки недоступні на цьому пристрої.','Calls are unavailable on this device.');return}
    const epoch=++callEpoch;callStarting=true;let stream;
    document.querySelectorAll('audio,video').forEach(p=>p.pause());
    try{
      stream=await capture(kind==='video');
      if(epoch!==callEpoch||!active()||config.chat()?.matchId!==chat.matchId){tracksOff(stream);return}
      if(call){tracksOff(stream);alert('У тебе вже є вхідний дзвінок.','You already have an incoming call.');return}
      const r=await api('call_start',{match_id:chat.matchId,media_kind:kind});
      if(!r.ok){tracksOff(stream);alert(r.error==='CALL_BUSY'?'Хтось із вас уже має активний дзвінок.':'Не вдалося почати дзвінок. Спробуй ще раз.',r.error==='CALL_BUSY'?'One of you already has an active call.':'Could not start the call. Please try again.');return}
      if(epoch!==callEpoch||!active()){tracksOff(stream);api('call_action',{call_id:r.call.id,operation:'end'});return}
      call={data:r.call,name:r.peer_name||chat.name,stream,cursor:0,ice:[],sent:Promise.resolve(),caller:true};
      renderCall();call.clock=setInterval(updateCallStatus,1000);schedulePoll(100);
    }catch(e){tracksOff(stream);permissionError(e,kind==='video')}finally{if(epoch===callEpoch)callStarting=false}
  }
  async function acceptCall(){
    const c=call;if(!c||c.accepting)return;c.accepting=true;$('callAccept').disabled=true;updateCallStatus();
    try{
      const stream=await capture(c.data.media_kind==='video');if(call!==c){tracksOff(stream);return}c.stream=stream;
      const r=await api('call_action',{call_id:c.data.id,operation:'accept'});
      if(call!==c){tracksOff(stream);return}
      if(!r.ok){clearCall();alert('Дзвінок уже завершився.','This call has ended.');return}
      c.data=r.call;c.accepting=false;renderCall();await connect(c);schedulePoll(100);
    }catch(e){if(call===c){c.accepting=false;tracksOff(c.stream);c.stream=null;if($('callAccept'))$('callAccept').disabled=false;updateCallStatus();permissionError(e,c.data.media_kind==='video')}}
  }
  function sendSignal(c,kind,payload){
    c.sent=c.sent.then(async()=>{
      if(call!==c)return;
      const r=await api('call_signal',{call_id:c.data.id,kind,payload});
      if(!r.ok&&call===c)throw new Error('Signaling failed');
    }).catch(()=>{if(call===c)endCall('end',t('З’єднання перервано. Спробуй зателефонувати ще раз.','Connection interrupted. Please try calling again.'))});
    return c.sent;
  }
  async function connect(c){
    if(call!==c||c.pc||c.connecting)return;c.connecting=true;
    try{
      if(!c.stream)throw new Error('Missing local media');
      const r=await api('rtc_config',{call_id:c.data.id});if(call!==c)return;if(!r.ok)throw new Error('Relay unavailable');
      c.relay=r.relay_available;
      if($('callNetwork'))$('callNetwork').textContent=r.relay_available?'':t('Пряме з’єднання. Деякі мережі можуть блокувати дзвінок.','Direct connection. Some networks may block calls.');
      const pc=c.pc=new RTCPeerConnection({iceServers:r.iceServers,iceTransportPolicy:r.iceTransportPolicy||'all'});
      c.stream.getTracks().forEach(track=>pc.addTrack(track,c.stream));
      pc.onicecandidate=e=>{if(e.candidate&&call===c)sendSignal(c,'ice',e.candidate.toJSON())};
      pc.ontrack=e=>{if(call!==c)return;c.remote=e.streams[0]||c.remote||new MediaStream();if(!e.streams[0])c.remote.addTrack(e.track);attachRemote(c)};
      pc.onconnectionstatechange=()=>{
        if(call!==c)return;
        if(pc.connectionState==='connected'){clearTimeout(c.connectTimeout);clearTimeout(c.disconnectTimeout);c.connected=c.connected||Date.now();updateCallStatus()}
        else if(pc.connectionState==='failed')endCall('end',t('Не вдалося з’єднати дзвінок. Спробуй іншу мережу або надішли голосове повідомлення.','Could not connect the call. Try another network or send a voice message.'));
        else if(pc.connectionState==='disconnected'){clearTimeout(c.disconnectTimeout);c.disconnectTimeout=setTimeout(()=>{if(call===c&&pc.connectionState!=='connected')endCall('end',t('Дзвінок завершено через втрату з’єднання.','Call ended after the connection was lost.'))},12000)}
        updateCallStatus();
      };
      c.connectTimeout=setTimeout(()=>{if(call===c&&!c.connected)endCall('end',t('Мережа не пропустила дзвінок. Спробуй іншу мережу або голосове повідомлення.','The network blocked the call. Try another network or a voice message.'))},35000);
      if(c.data.caller_id===config.userId()){
        const offer=await pc.createOffer();if(call!==c)return;await pc.setLocalDescription(offer);await sendSignal(c,'offer',{type:pc.localDescription.type,sdp:pc.localDescription.sdp});
      }
    }catch{if(call===c)await endCall('end',t('Не вдалося підготувати дзвінок. Спробуй ще раз.','Could not prepare the call. Please try again.'))}finally{c.connecting=false}
  }
  async function receive(c,signals){
    if(!c.pc)return;
    for(const s of signals){
      if(call!==c)return;
      if(s.kind==='ice'){
        if(c.pc.remoteDescription)await c.pc.addIceCandidate(s.payload);else c.ice.push(s.payload);
      }else if(s.kind==='offer'&&!c.pc.remoteDescription){
        await c.pc.setRemoteDescription(s.payload);const answer=await c.pc.createAnswer();if(call!==c)return;await c.pc.setLocalDescription(answer);await sendSignal(c,'answer',{type:c.pc.localDescription.type,sdp:c.pc.localDescription.sdp});
      }else if(s.kind==='answer'&&!c.pc.remoteDescription)await c.pc.setRemoteDescription(s.payload);
      c.cursor=Math.max(c.cursor,Number(s.id));
      if(c.pc.remoteDescription)while(c.ice.length)await c.pc.addIceCandidate(c.ice.shift());
    }
  }
  function schedulePoll(ms=call?1800:8000){clearTimeout(pollTimer);if(started)pollTimer=setTimeout(poll,ms)}
  async function poll(){
    if(!started||polling)return;
    if(!active()||(!call&&document.visibilityState!=='visible')){schedulePoll();return}
    polling=true;const previous=call;
    try{
      const r=await api('call_poll',{call_id:previous?.data.id||null,cursor:previous?.cursor||0});
      if(previous&&call!==previous)return;
      if(!r.ok){if(previous&&[403,404].includes(r.status))clearCall();else if(previous&&Date.now()-(previous.lastPoll||Date.now())>25000)endCall('end',t('Дзвінок завершено через втрату з’єднання.','Call ended after the connection was lost.'));return}
      if(!r.call)return;
      if(!['ringing','accepted'].includes(r.call.state)){
        if(previous){const label=r.call.state==='rejected'?t('Дзвінок відхилено.','Call declined.'):r.call.state==='missed'?t('Немає відповіді.','No answer.'):t('Дзвінок завершено.','Call ended.');clearCall();config.alert(label)}return;
      }
      if(!call){
        if(r.call.caller_id===config.userId()){await api('call_action',{call_id:r.call.id,operation:'end'});return}
        if(recording)disposeRecording();
        call={data:r.call,name:r.peer_name,cursor:0,ice:[],sent:Promise.resolve()};renderCall();call.clock=setInterval(updateCallStatus,1000);
      }
      const c=call;c.lastPoll=Date.now();const changed=c.data.state!==r.call.state;c.data=r.call;
      if(changed)renderCall();
      if(c.data.state==='accepted'&&c.stream){await connect(c);if(call===c)await receive(c,r.signals||[])}
      updateCallStatus();
    }catch{if(previous&&call===previous)await endCall('end',t('З’єднання перервано. Спробуй ще раз.','Connection interrupted. Please try again.'))}
    finally{polling=false;schedulePoll()}
  }
  function start(){if(started)return;started=true;schedulePoll(200)}
  function stop(){callEpoch++;callStarting=false;started=false;clearTimeout(pollTimer);disposeRecording();const c=call;clearCall();if(c)api('call_action',{call_id:c.data.id,operation:'end'})}
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden'){if(recording?.state==='recording')stopRecording()}
    else if(started)schedulePoll(100);
  });
  window.addEventListener('pagehide',stop);
  window.addEventListener('pageshow',()=>{if(active())start()});
  // The sheet may be replaced by a profile, safety menu or account settings.
  new MutationObserver(()=>{if(recording&&(!$('chatMessage')||config.chat()?.matchId!==recording.matchId))disposeRecording()}).observe(config.content,{childList:true});
  return {mount,messageMarkup,bindMessages,disposeRecording,start,stop,poll:()=>schedulePoll(50),endCall};
}};
