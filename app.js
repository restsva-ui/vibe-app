const tg=window.Telegram?.WebApp;if(tg){tg.ready();tg.expand();tg.setHeaderColor("#0b0b12");tg.setBackgroundColor("#0b0b12")}const tuser=tg?.initDataUnsafe?.user;const $=id=>document.getElementById(id),store=(k,v)=>localStorage.setItem(k,JSON.stringify(v)),load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};

const SUPABASE_URL="https://qifxxzpnuxchnkowxzgp.supabase.co";
const SUPABASE_KEY="sb_publishable_a-yy3lcgCXbDJosdQAWbPQ_bRLnN_LF";
const TELEGRAM_AUTH_URL=SUPABASE_URL+"/functions/v1/telegram-auth";
const realtimeClient=window.supabase?.createClient?.(SUPABASE_URL,SUPABASE_KEY,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
});
let realtimeUserTopic=null,realtimeUserChannel=null,realtimeUserChannelTopic=null,realtimeConnected=false;
const realtimeMatchChannels=new Map();
let activeChat=null,chatRefreshTimer=null,socialRefreshTimer=null,typingStopTimer=null,lastTypingSentAt=0;

async function secureApi(action,payload={}){
  const initData=tg?.initData;
  if(!initData)return {ok:false,error:"Відкрий VYBE через Telegram-бота"};
  try{
    const r=await fetch(TELEGRAM_AUTH_URL,{method:"POST",headers:{"Content-Type":"application/json",apikey:SUPABASE_KEY},body:JSON.stringify({action,initData,...payload})});
    const text=await r.text();let body=null;try{body=text?JSON.parse(text):null}catch{}
    if(!r.ok||!body?.ok)throw new Error(body?.error||text||"Server request failed");
    return body;
  }catch(e){console.error("VYBE secure API",action,e);return {ok:false,error:e?.message||"Network error"}}
}
async function verifyTelegramAuth(){return secureApi("me")}

function formatMessageTime(iso){
  if(!iso)return "";
  const d=new Date(iso);
  if(Number.isNaN(d.getTime()))return "";
  return d.toLocaleTimeString("uk-UA",{hour:"2-digit",minute:"2-digit"});
}
function formatChatListTime(iso){
  if(!iso)return "";
  const d=new Date(iso);if(Number.isNaN(d.getTime()))return "";
  const n=new Date();
  if(d.toDateString()===n.toDateString())return formatMessageTime(iso);
  return d.toLocaleDateString("uk-UA",{day:"2-digit",month:"2-digit"});
}
function scheduleSocialRefresh(delay=180){
  clearTimeout(socialRefreshTimer);
  socialRefreshTimer=setTimeout(async()=>{await Promise.all([loadPeople(),loadMatches()]);},delay);
}
function scheduleActiveChatRefresh(delay=120){
  if(!activeChat)return;
  clearTimeout(chatRefreshTimer);
  chatRefreshTimer=setTimeout(()=>{
    if(!activeChat)return;
    openChat(activeChat.matchId,activeChat.name,activeChat.userId,{silent:true,preserveDraft:true,noMatchRefresh:true});
  },delay);
}
function setTypingLabel(show){
  const el=$("chatPresence");
  if(!el)return;
  el.textContent=show?"друкує…":chatConnectionLabel();
  el.classList.toggle("typing",show);
}
function getMatchChannel(matchId){return realtimeMatchChannels.get(String(matchId))?.channel||null}
function sendTyping(matchId,typing){
  const channel=getMatchChannel(matchId);if(!channel)return;
  channel.send({type:"broadcast",event:"typing",payload:{typing:typing===true}}).catch?.(()=>{});
}
function bindTyping(matchId){
  const field=$("chatMessage");if(!field)return;
  field.addEventListener("input",()=>{
    const now=Date.now();
    if(now-lastTypingSentAt>700){lastTypingSentAt=now;sendTyping(matchId,true)}
    clearTimeout(typingStopTimer);
    typingStopTimer=setTimeout(()=>sendTyping(matchId,false),1200);
  });
}
function setRealtimeBadge(live){
  realtimeConnected=live===true;
  const el=$("realtimeStatus");if(!el)return;
  el.textContent=realtimeConnected?"● realtime":"● автооновлення";
  el.classList.toggle("offline",!realtimeConnected);
}
function chatConnectionLabel(){return realtimeConnected?"realtime • приватний чат":"автооновлення • приватний чат"}
function setupUserRealtime(topic){
  if(!realtimeClient||!topic){setRealtimeBadge(false);return}
  if(realtimeUserChannel&&realtimeUserChannelTopic===topic)return;
  if(realtimeUserChannel)realtimeClient.removeChannel(realtimeUserChannel);
  realtimeUserChannelTopic=topic;
  realtimeUserChannel=realtimeClient.channel("vybe:user:"+topic,{config:{broadcast:{self:false}}})
    .on("broadcast",{event:"match_created"},()=>scheduleSocialRefresh(80))
    .on("broadcast",{event:"chat_changed"},payload=>{
      const changedMatch=String(payload?.payload?.match_id||"");
      if(activeChat?.matchId===changedMatch&&String(payload?.payload?.sender_id||"")!==String(profile?.user_id)){
        scheduleActiveChatRefresh(50);
      }
      scheduleSocialRefresh(80);
    })
    .on("broadcast",{event:"relationship_changed"},()=>{
      if(activeChat){activeChat=null;sheet?.classList?.add("hidden");syncMatchRealtimeChannels()}
      scheduleSocialRefresh(80);
    })
    .subscribe(status=>setRealtimeBadge(status==="SUBSCRIBED"));
}
function syncMatchRealtimeChannels(){
  if(!realtimeClient)return;
  const wantedId=activeChat?.matchId||null;
  for(const [matchId,entry] of realtimeMatchChannels){
    if(matchId!==wantedId){realtimeClient.removeChannel(entry.channel);realtimeMatchChannels.delete(matchId)}
  }
  if(!wantedId||realtimeMatchChannels.has(wantedId))return;
  const m=matches.find(x=>String(x.match_id)===wantedId);
  if(!m?.realtime_topic)return;
  const channel=realtimeClient.channel("vybe:match:"+m.realtime_topic,{config:{broadcast:{self:false}}})
    .on("broadcast",{event:"message_created"},payload=>{
      const senderId=String(payload?.payload?.sender_id||"");
      if(activeChat?.matchId===wantedId&&senderId!==String(profile?.user_id))scheduleActiveChatRefresh(50);
    })
    .on("broadcast",{event:"read_updated"},payload=>{
      const readerId=String(payload?.payload?.reader_id||"");
      if(activeChat?.matchId===wantedId&&readerId!==String(profile?.user_id))scheduleActiveChatRefresh(50);
    })
    .on("broadcast",{event:"typing"},payload=>{
      if(activeChat?.matchId===wantedId)setTypingLabel(payload?.payload?.typing===true);
    })
    .subscribe();
  realtimeMatchChannels.set(wantedId,{channel,topic:m.realtime_topic});
}
setInterval(()=>{
  if(document.visibilityState!=="visible")return;
  loadMatches();
  if(activeChat)scheduleActiveChatRefresh(0);
},15000);
async function claimReferral(){
  const initParams=new URLSearchParams(tg?.initData||"");
  const pageParams=new URLSearchParams(location.search);
  const code=String(tg?.initDataUnsafe?.start_param||initParams.get("start_param")||pageParams.get("tgWebAppStartParam")||pageParams.get("ref")||"").trim().toLowerCase();
  if(!code)return;
  const r=await secureApi("referral_claim",{code});
  if(r.ok&&(r.claimed===true||r.reason==="already_claimed"))localStorage.setItem("vybeReferral:"+code,"1");
  else console.warn("VYBE referral claim failed",r);
}
async function openReferral(){
  const r=await secureApi("referral_stats");if(!r.ok){tg?.showAlert?.("Не вдалося завантажити реферальну статистику.");return}
  const link="https://t.me/vybe_now_bot?start="+encodeURIComponent("ref_"+r.code);
  const rewards=(r.rewards||[]).map(x=>'<div class="choice" style="margin-top:8px;opacity:'+(x.unlocked?'1':'.72')+'"><b>'+(x.unlocked?'✅ ':'🔒 ')+x.milestone+' активн.</b> — '+x.label+'<br><small>'+(x.unlocked?'Отримано':'Прогрес: '+x.progress+'/'+x.milestone)+'</small></div>').join("");
  content.innerHTML='<h2>Запросити друзів 🔗</h2><p>Запрошено: <b>'+r.invited+'</b> • Активували анкету: <b>'+r.activated+'</b></p><h3 style="margin:14px 0 6px">Нагороди 🎁</h3>'+rewards+'<p style="margin-top:12px">Зараховуються лише друзі, які створили анкету 18+.</p><button id="shareReferral" class="primary">Поділитися запрошенням</button><button id="copyReferral" class="choice" style="width:100%;margin-top:10px">Скопіювати посилання</button>';
  sheet.classList.remove("hidden");
  $("shareReferral").onclick=()=>{const u="https://t.me/share/url?url="+encodeURIComponent(link)+"&text="+encodeURIComponent("Приєднуйся до VYBE 💜. Відкрий бота та натисни кнопку запуску VYBE.");tg?.openTelegramLink?.(u)};
  $("copyReferral").onclick=async()=>{try{await navigator.clipboard.writeText(link);tg?.showAlert?.("Посилання скопійовано ✅")}catch{tg?.showAlert?.(link)}};
}

const REPORT_REASONS=[
  ["fake_profile","Фейкова анкета / видає себе за іншу людину"],
  ["spam","Спам або шахрайство"],
  ["harassment","Образи, переслідування або шантаж"],
  ["underage","Можливо, користувачу немає 18 років"],
  ["sexual_services","Продаж або купівля сексуальних послуг"],
  ["illegal_content","Незаконний або небезпечний контент"],
  ["other","Інша причина"],
];

function confirmAction(message){
  return new Promise(resolve=>{
    if(tg?.showConfirm)tg.showConfirm(message,ok=>resolve(ok===true));
    else resolve(window.confirm(message));
  });
}

async function refreshSocial(){
  await Promise.all([loadPeople(),loadMatches()]);
  renderCard();renderMatches();renderChats();
}

function openUserSafety(userId,name){
  if(!userId)return;
  sendTyping(activeChat?.matchId,false);activeChat=null;syncMatchRealtimeChannels();
  const safeName=escapeHtml(name||"користувача");
  content.innerHTML='<h2>Безпека 🛡</h2><p>Дії щодо <b>'+safeName+'</b>.</p><button id="reportUserBtn" class="choice safetyChoice">⚑ Поскаржитися</button><button id="blockUserBtn" class="choice safetyChoice dangerChoice">🚫 Заблокувати</button><p class="safetyHint">Після блокування ви не бачитимете одне одного у VYBE, а чат і нові лайки стануть недоступними.</p>';
  sheet.classList.remove("hidden");
  $("reportUserBtn").onclick=()=>openReport(userId,name);
  $("blockUserBtn").onclick=()=>blockUser(userId,name);
}

async function blockUser(userId,name){
  const ok=await confirmAction("Заблокувати "+(name||"цього користувача")+"? Ви більше не бачитимете одне одного у VYBE.");
  if(!ok)return;
  const r=await secureApi("block_user",{target_user_id:userId});
  if(!r.ok){tg?.showAlert?.("Не вдалося заблокувати користувача.");return}
  sheet.classList.add("hidden");
  await refreshSocial();
  tg?.HapticFeedback?.notificationOccurred("success");
  tg?.showAlert?.("Користувача заблоковано.");
}

function openReport(userId,name){
  const options=REPORT_REASONS.map(([value,label])=>'<option value="'+value+'">'+escapeHtml(label)+'</option>').join("");
  content.innerHTML='<h2>Поскаржитися ⚑</h2><p>Скарга на <b>'+escapeHtml(name||"користувача")+'</b> буде передана на модерацію.</p><label>Причина<select id="reportReason" class="field">'+options+'</select></label><label>Деталі<textarea id="reportDetails" class="field" maxlength="1000" placeholder="Коротко опиши, що сталося. Не додавай зайві особисті дані."></textarea></label><label class="checkRow safetyCheck"><input id="reportBlock" type="checkbox" checked><span>Також заблокувати цього користувача</span></label><button id="submitReport" class="primary">Надіслати скаргу</button>';
  sheet.classList.remove("hidden");
  $("submitReport").onclick=async()=>{
    const button=$("submitReport");
    button.disabled=true;
    const r=await secureApi("report_user",{
      target_user_id:userId,
      reason:$("reportReason").value,
      details:$("reportDetails").value.trim(),
      block:$("reportBlock").checked,
    });
    if(!r.ok){button.disabled=false;tg?.showAlert?.("Не вдалося надіслати скаргу.");return}
    sheet.classList.add("hidden");
    if(r.blocked)await refreshSocial();
    tg?.HapticFeedback?.notificationOccurred("success");
    tg?.showAlert?.(r.blocked?"Скаргу надіслано, користувача заблоковано.":"Скаргу надіслано.");
  };
}

async function openBlockedUsers(){
  content.innerHTML='<h2>Заблоковані користувачі 🚫</h2><div class="empty">Завантаження…</div>';
  sheet.classList.remove("hidden");
  const r=await secureApi("blocks_list");
  if(!r.ok){content.innerHTML='<h2>Заблоковані користувачі 🚫</h2><div class="empty">Не вдалося завантажити список.</div>';return}
  const rows=r.blocked||[];
  content.innerHTML='<h2>Заблоковані користувачі 🚫</h2>'+(rows.length?rows.map((x,i)=>{
    const n=x.profile?.name||"Користувач";
    const meta=[x.profile?.age,x.profile?.city].filter(Boolean).join(" • ");
    return '<div class="blockedRow"><div><b>'+escapeHtml(n)+'</b><small>'+escapeHtml(meta)+'</small></div><button class="choice unblockBtn" data-index="'+i+'">Розблокувати</button></div>';
  }).join(""):'<div class="empty">Тут поки нікого немає.</div>');
  content.querySelectorAll(".unblockBtn").forEach(btn=>btn.onclick=async()=>{
    const row=rows[Number(btn.dataset.index)];if(!row)return;
    btn.disabled=true;
    const x=await secureApi("unblock_user",{target_user_id:row.user_id});
    if(!x.ok){btn.disabled=false;tg?.showAlert?.("Не вдалося розблокувати.");return}
    await refreshSocial();
    await openBlockedUsers();
  });
}

let profile=load("vybeProfile",null),now=load("vybeNow",null),matches=[],index=0,filter="Усе",remotePeople=[],entitlements={balances:{supervybe:0,spotlight:0},vybe_plus_until:null,spotlight_until:null};
let discoverFilters=load("vybeDiscoverFilters",{minAge:18,maxAge:99,city:"",onlineOnly:false,verifiedOnly:false});
localStorage.removeItem("vybeMatches");
async function loadEntitlements(){const r=await secureApi("entitlements");if(r.ok)entitlements=r;return r}
function spotlightStatus(){const until=entitlements?.spotlight_until?new Date(entitlements.spotlight_until):null;if(!until||until<=new Date())return "не активний";const min=Math.max(1,Math.ceil((until-Date.now())/60000));return "🔦 активний ще "+min+" хв."}
function entitlementText(){const plus=entitlements?.vybe_plus_until&&new Date(entitlements.vybe_plus_until)>new Date()?new Date(entitlements.vybe_plus_until).toLocaleDateString("uk-UA"):"—";return "SuperVYBE: "+(entitlements?.balances?.supervybe||0)+" • Spotlight: "+(entitlements?.balances?.spotlight||0)+" • "+spotlightStatus()+" • VYBE+ до: "+plus}
async function useSpotlight(){const r=await secureApi("spotlight_use");if(!r.ok){tg?.showAlert?.("Spotlight не списано. Перевір баланс і спробуй ще раз.");return}await loadEntitlements();tg?.HapticFeedback?.notificationOccurred("success");tg?.showAlert?.("Spotlight активовано на 30 хвилин ✨");openSheet("premium")}

const intentIcon=x=>({"Поговорити":"💬","Флірт":"🔥","Вірт":"🌙","Дружба":"🫶","Голос":"🎙","Зустріч":"☕"}[x]||"⚡");
$("hello").textContent="Привіт, "+(tuser?.first_name||profile?.name||"")+" 👋";

async function syncProfile(){
  if(!profile)return false;
  const r=await secureApi("save_profile",{profile});
  if(!r.ok)return false;
  profile={...profile,user_id:r.user_id};store("vybeProfile",profile);return true;
}
async function syncNow(hours=1){
  if(!now)return false;
  const r=await secureApi("set_intent",{intent:now.intent,hours});
  if(!r.ok)return false;
  if(r.expires_at){now.expires=new Date(r.expires_at).getTime();store("vybeNow",now);renderNow()}
  return true;
}
async function loadPeople(){
  const r=await secureApi("discover",{
    min_age:Number(discoverFilters.minAge)||18,
    max_age:Number(discoverFilters.maxAge)||99,
    city:String(discoverFilters.city||""),
    online_only:discoverFilters.onlineOnly===true,
    verified_only:discoverFilters.verifiedOnly===true,
  });if(!r.ok)return;
  remotePeople=(r.people||[]).map(p=>({
    id:p.user_id,
    name:p.name||"VYBE",
    age:p.age||18,
    intent:p.intent||"Поговорити",
    icon:intentIcon(p.intent),
    bio:p.bio||"Новий користувач VYBE",
    meta:[p.city||"VYBE",p.online?"● онлайн":"нещодавно",p.verified?"✓ верифіковано":""].filter(Boolean).join(" • "),
    img:p.photo_url||null,
    verified:p.verified===true,
    online:p.online===true,
  }));
  index=0;renderCard();
}
async function hydrateProfile(){
  const r=await secureApi("profile_get");if(!r.ok)return;
  if(r.realtime_topic){realtimeUserTopic=r.realtime_topic;setupUserRealtime(realtimeUserTopic)}
  if(r.profile){profile={name:r.profile.name,age:r.profile.age,city:r.profile.city||"",gender:r.profile.gender||"",looking:r.profile.looking_for||"",bio:r.profile.bio||"",photo_url:r.profile.photo_url||null,verified:r.profile.verified===true,user_id:r.user_id};store("vybeProfile",profile)}
}
async function begin(){
  const auth=await verifyTelegramAuth();window.__vybeAuth=auth;
  if(!auth?.ok){console.warn("VYBE secure auth not confirmed",auth);tg?.showAlert?.("Не вдалося підтвердити Telegram-авторизацію. Відкрий VYBE заново через бота.");return}
  await claimReferral();
  await hydrateProfile();
  if(!profile)showOnboarding();else{renderProfile();await syncProfile();await loadPeople()}
  await loadEntitlements();await loadMatches();renderNow();renderCard();renderMatches();renderChats();
}
const age=$("ageConfirm"),enterBtn=$("enterBtn");
function syncAgeButton(){enterBtn.disabled=!age.checked}
age.addEventListener("change",syncAgeButton);
age.addEventListener("input",syncAgeButton);
enterBtn.addEventListener("click",async()=>{
  if(!age.checked)return;
  enterBtn.disabled=true;enterBtn.textContent="Входимо…";
  localStorage.setItem("vybe18","yes");$("ageGate").classList.add("hidden");
  try{await begin()}finally{enterBtn.textContent="Увійти";syncAgeButton()}
});
syncAgeButton();
if(localStorage.getItem("vybe18")==="yes"){$("ageGate").classList.add("hidden");setTimeout(begin,0)}
function showOnboarding(){const o=$("onboarding");o.classList.remove("hidden");$("obName").value=profile?.name||tuser?.first_name||"";$("obAge").value=profile?.age||"";$("obCity").value=profile?.city||"";$("obGender").value=profile?.gender||"";$("obLooking").value=profile?.looking||"";$("obBio").value=profile?.bio||""}
$("saveProfile").onclick=async()=>{const age=+$("obAge").value;if(!$("obName").value.trim()||age<18||age>99){tg?.showAlert?.("Вкажи ім’я та вік 18+.");return}profile={...profile,name:$("obName").value.trim(),age,city:$("obCity").value.trim(),gender:$("obGender").value.trim(),looking:$("obLooking").value.trim(),bio:$("obBio").value.trim()};store("vybeProfile",profile);$("onboarding").classList.add("hidden");renderProfile();await syncProfile();await loadPeople();tg?.HapticFeedback?.notificationOccurred("success")};
$("editProfile").onclick=showOnboarding;
function renderProfile(){
  if(!profile)return;
  $("profileName").textContent=profile.name+", "+profile.age+(profile.verified?" ✓":"");
  $("profileMeta").textContent=[profile.city,profile.gender,profile.looking&&"Шукаю: "+profile.looking].filter(Boolean).join(" • ");
  $("profileBio").textContent=profile.bio||"Без опису";
  const avatar=$("profileAvatar");
  if(avatar){
    if(profile.photo_url){
      avatar.textContent="";
      avatar.style.backgroundImage='url("'+String(profile.photo_url).replace(/"/g,"%22")+'")';
      avatar.classList.add("hasPhoto");
    }else{
      avatar.style.backgroundImage="";
      avatar.textContent="👤";
      avatar.classList.remove("hasPhoto");
    }
  }
  const remove=$("removePhotoBtn");if(remove)remove.classList.toggle("hidden",!profile.photo_url);
}

function readImageAsDataUrl(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error("read_failed"));
    reader.onload=()=>resolve(String(reader.result||""));
    reader.readAsDataURL(file);
  });
}
async function prepareProfilePhoto(file){
  if(!file||!String(file.type||"").startsWith("image/"))throw new Error("not_image");
  if(file.size>12*1024*1024)throw new Error("too_large_source");
  const src=await readImageAsDataUrl(file);
  const img=new Image();
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=src});
  const side=Math.min(img.naturalWidth,img.naturalHeight);
  const sx=Math.max(0,(img.naturalWidth-side)/2),sy=Math.max(0,(img.naturalHeight-side)/2);
  const canvas=document.createElement("canvas");canvas.width=900;canvas.height=900;
  const ctx=canvas.getContext("2d",{alpha:false});if(!ctx)throw new Error("canvas_failed");
  ctx.drawImage(img,sx,sy,side,side,0,0,900,900);
  let out=canvas.toDataURL("image/webp",.82);
  if(!out.startsWith("data:image/webp"))out=canvas.toDataURL("image/jpeg",.82);
  let [header,data]=out.split(",");
  if(!data)throw new Error("encode_failed");
  let mime=header.match(/^data:([^;]+)/)?.[1]||"image/jpeg";
  if(data.length>2500000){
    out=canvas.toDataURL(mime,.68);[header,data]=out.split(",");mime=header.match(/^data:([^;]+)/)?.[1]||mime;
  }
  if(!data||data.length>2800000)throw new Error("too_large_encoded");
  return {mime,image_base64:data};
}
async function uploadProfilePhoto(file){
  const btn=$("photoBtn");if(btn){btn.disabled=true;btn.textContent="Обробляємо фото…"}
  try{
    const prepared=await prepareProfilePhoto(file);
    if(btn)btn.textContent="Завантажуємо…";
    const r=await secureApi("photo_upload",{mime_type:prepared.mime,image_base64:prepared.image_base64});
    if(!r.ok)throw new Error(r.error||"upload_failed");
    profile={...profile,photo_url:r.photo_url||null};store("vybeProfile",profile);renderProfile();await loadPeople();
    tg?.HapticFeedback?.notificationOccurred("success");tg?.showAlert?.("Фото профілю оновлено ✅");
  }catch(e){
    console.error("VYBE photo upload",e);
    tg?.showAlert?.("Не вдалося завантажити фото. Обери JPG/PNG/WebP до 12 МБ.");
  }finally{
    if(btn){btn.disabled=false;btn.textContent=profile?.photo_url?"Змінити фото":"Додати фото"}
  }
}
async function removeProfilePhoto(){
  if(!profile?.photo_url)return;
  const ok=await confirmAction("Видалити фото профілю?");
  if(!ok)return;
  const r=await secureApi("photo_remove");
  if(!r.ok){tg?.showAlert?.("Не вдалося видалити фото.");return}
  profile={...profile,photo_url:null};store("vybeProfile",profile);renderProfile();await loadPeople();
}

function openDiscoverFilters(){
  const f=discoverFilters||{};
  content.innerHTML='<h2>Фільтри 🔎</h2><div class="filterTwo"><label>Вік від<input id="filterMinAge" class="field" type="number" min="18" max="99" value="'+escapeHtml(f.minAge||18)+'"></label><label>до<input id="filterMaxAge" class="field" type="number" min="18" max="99" value="'+escapeHtml(f.maxAge||99)+'"></label></div><label>Місто<input id="filterCity" class="field" maxlength="40" placeholder="Напр. Київ" value="'+escapeHtml(f.city||"")+'"></label><label class="checkRow filterCheck"><input id="filterOnline" type="checkbox" '+(f.onlineOnly?"checked":"")+'><span>Лише онлайн зараз</span></label><label class="checkRow filterCheck"><input id="filterVerified" type="checkbox" '+(f.verifiedOnly?"checked":"")+'><span>Лише верифіковані</span></label><button id="saveFilters" class="primary">Застосувати</button><button id="resetFilters" class="choice filterReset">Скинути фільтри</button>';
  sheet.classList.remove("hidden");
  $("saveFilters").onclick=async()=>{
    const minAge=Math.max(18,Math.min(99,Number($("filterMinAge").value)||18));
    const maxAge=Math.max(minAge,Math.min(99,Number($("filterMaxAge").value)||99));
    discoverFilters={minAge,maxAge,city:$("filterCity").value.trim(),onlineOnly:$("filterOnline").checked,verifiedOnly:$("filterVerified").checked};
    store("vybeDiscoverFilters",discoverFilters);sheet.classList.add("hidden");await loadPeople();
  };
  $("resetFilters").onclick=async()=>{
    discoverFilters={minAge:18,maxAge:99,city:"",onlineOnly:false,verifiedOnly:false};
    store("vybeDiscoverFilters",discoverFilters);sheet.classList.add("hidden");await loadPeople();
  };
}
function validNow(){return now&&now.expires>Date.now()}
function renderNow(){if(!validNow()){now=null;localStorage.removeItem("vybeNow");$("nowLabel").textContent="⚡ VYBE NOW не задано";$("nowTime").textContent="Покажи, чого хочеш саме зараз";return}$("nowLabel").textContent=now.icon+" "+now.intent;$("nowTime").textContent="Активний ще "+Math.max(1,Math.ceil((now.expires-Date.now())/3600000))+" год."}
const sheet=$("sheet"),content=$("sheetContent");$("closeSheet").onclick=()=>{sendTyping(activeChat?.matchId,false);activeChat=null;syncMatchRealtimeChannels();clearTimeout(typingStopTimer);sheet.classList.add("hidden")};
function openSheet(type){let h="";if(type==="now")h='<h2>Твій VYBE NOW ⚡</h2><p>Що ти хочеш саме зараз?</p><div class="choiceGrid">'+[["💬","Поговорити"],["🔥","Флірт"],["🌙","Вірт"],["🫶","Дружба"],["🎙","Голос"],["☕","Зустріч"]].map(x=>'<button class="choice" data-intent="'+x[1]+'" data-icon="'+x[0]+'">'+x[0]+" "+x[1]+"</button>").join("")+'</div><p>На скільки?</p><div class="choiceGrid"><button class="choice duration selected" data-hours="1">1 година</button><button class="choice duration" data-hours="3">3 години</button><button id="smartDuration" class="choice duration" data-smart="1">До ранку</button></div><button id="saveNow" class="primary">Увімкнути VYBE NOW</button>';else if(type==="premium"){const b=entitlements?.balances||{};const plus=entitlements?.vybe_plus_until&&new Date(entitlements.vybe_plus_until)>new Date()?new Date(entitlements.vybe_plus_until).toLocaleDateString("uk-UA"):"не активний";h='<h2>Мої бонуси ✨</h2><p>'+entitlementText()+'</p><div class="priceGrid"><div class="price"><span>SuperVYBE</span><strong>'+Number(b.supervybe||0)+'</strong></div><div class="price"><span>Spotlight</span><strong>'+Number(b.spotlight||0)+'</strong></div><div class="price"><span>VYBE+</span><strong>'+plus+'</strong></div></div>'+(Number(b.spotlight||0)>0?'<button id="useSpotlight" class="primary">Активувати Spotlight на 30 хв</button>':'')+'<p><small>SuperVYBE витрачається кнопкою ✦ на реальній анкеті.</small></p>';} else if(type==="filter")h='<h2>Фільтри</h2><p>Вік, місто, дистанція, кого шукаєш, онлайн та верифікація — наступний етап.</p><button class="primary" onclick="document.getElementById(\'sheet\').classList.add(\'hidden\')">Готово</button>';else if(type==="safety")h='<h2>Безпека 🛡</h2><p>VYBE працює тільки для 18+. Блокування та скарги вже захищені серверною перевіркою: заблоковані користувачі не бачать одне одного у пошуку, збігах і чатах.</p><button id="openBlockedFromSafety" class="choice safetyChoice">🚫 Мої блокування</button><p class="safetyHint">Якщо бачиш погрози, шантаж, неповнолітнього користувача, незаконний контент або пропозиції сексуальних послуг — надішли скаргу з профілю/чату.</p>';else h='<h2>VYBE</h2>';content.innerHTML=h;sheet.classList.remove("hidden");if(type==="safety"){const b=$("openBlockedFromSafety");if(b)b.onclick=openBlockedUsers}if(type==="premium"){const u=$("useSpotlight");if(u)u.onclick=useSpotlight}if(type==="now"){let chosen=null,hours=1;
const smart=content.querySelector("#smartDuration");
if(smart){const d=new Date(),hour=d.getHours();let target=new Date(d);
if(hour<8){target.setHours(8,0,0,0);smart.textContent="До ранку";}
else if(hour<18){target.setHours(20,0,0,0);smart.textContent="До вечора";}
else{target.setDate(target.getDate()+1);target.setHours(8,0,0,0);smart.textContent="До ранку";}
smart.dataset.until=String(target.getTime());}content.querySelectorAll(".choice[data-intent]").forEach(b=>b.onclick=()=>{content.querySelectorAll(".choice[data-intent]").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");chosen={intent:b.dataset.intent,icon:b.dataset.icon}});content.querySelectorAll(".duration").forEach(b=>b.onclick=()=>{content.querySelectorAll(".duration").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");hours=b.dataset.smart?Math.max(1,(Number(b.dataset.until)-Date.now())/3600000):+b.dataset.hours});$("saveNow").onclick=async()=>{if(!chosen){tg?.showAlert?.("Спочатку обери свій вайб.");return}now={...chosen,expires:Date.now()+hours*3600000};store("vybeNow",now);renderNow();await syncNow(hours);sheet.classList.add("hidden");tg?.HapticFeedback?.notificationOccurred("success")}}}
$("setNow").onclick=()=>openSheet("now");$("premiumBtn").onclick=()=>openSheet("premium");$("filterBtn").onclick=openDiscoverFilters;$("safetyBtn").onclick=()=>openSheet("safety");
function people(){return remotePeople}function filtered(){const arr=people();return filter==="Усе"?arr:arr.filter(p=>p.intent===filter)}
function renderCard(){const arr=filtered();if(!arr.length||index>=arr.length){$("cardStack").innerHTML='<div class="empty">Анкет за цим вайбом поки немає.<br>Спробуй інший фільтр.</div>';return}const p=arr[index];const visual=p.img?'<img src="'+escapeHtml(p.img)+'" alt="'+escapeHtml(p.name)+'">':'<div class="generatedAvatar">'+escapeHtml(p.name?.[0]||"V")+'</div>';$("cardStack").innerHTML='<article class="personCard">'+visual+'<button id="cardSafetyBtn" class="cardSafety" aria-label="Безпека">⋯</button><div class="gradient"></div><div class="personMeta"><div class="nameRow"><h2>'+escapeHtml(p.name)+", "+escapeHtml(p.age)+(p.verified?' <span class="verifiedMark">✓</span>':'')+'</h2></div><div class="intent">'+escapeHtml(p.icon)+" "+escapeHtml(p.intent)+'</div><p class="bio">'+escapeHtml(p.bio)+'</p><div class="meta">'+escapeHtml(p.meta)+"</div></div></article>";const safety=$("cardSafetyBtn");if(safety)safety.onclick=e=>{e.stopPropagation();openUserSafety(p.id,p.name)}}
function updateUnreadBadge(total){const nav=[...document.querySelectorAll(".navItem")].find(x=>x.dataset.target==="chatView");if(!nav)return;let badge=nav.querySelector(".navUnread");if(!badge){badge=document.createElement("b");badge.className="navUnread";nav.appendChild(badge)}badge.textContent=total>99?"99+":String(total);badge.classList.toggle("hidden",!total)}
async function loadMatches(){
  const r=await secureApi("matches");if(!r.ok)return false;
  matches=(r.matches||[]).map(m=>({
    match_id:m.match_id,
    realtime_topic:m.realtime_topic||null,
    id:m.user_id,
    name:m.profile?.name||"VYBE",
    age:m.profile?.age||"",
    city:m.profile?.city||"",
    bio:m.profile?.bio||"",
    photo_url:m.profile?.photo_url||null,
    verified:m.profile?.verified===true,
    online:m.profile?.online===true,
    icon:"♡",
    unread_count:Number(m.unread_count||0),
    last_message:m.last_message||"",
    last_message_at:m.last_message_at||null,
  }));
  updateUnreadBadge(Number(r.unread_total||0));
  syncMatchRealtimeChannels();
  renderMatches();renderChats();return true;
}
async function next(kind){
  const arr=filtered(),p=arr[index];
  if((kind==="like"||kind==="super")&&p){
    if(String(p.id).startsWith("demo")){tg?.showAlert?.("Це демо-анкета. Реальна дія працює тільки для реальних користувачів.");return}
    if(kind==="super"){
      await loadEntitlements();
      if(Number(entitlements?.balances?.supervybe||0)<1){openSheet("premium");return}
    }
    const r=kind==="super"
      ? await secureApi("super_like",{target_user_id:p.id})
      : await secureApi("like",{target_user_id:p.id,kind:"like"});
    if(!r.ok){tg?.showAlert?.(kind==="super"?"SuperVYBE не списано. Спробуй ще раз.":"Не вдалося надіслати VYBE. Спробуй ще раз.");return}
    if(kind==="super")await loadEntitlements();
    if(r.matched){await loadMatches();tg?.HapticFeedback?.notificationOccurred("success");tg?.showAlert?.("У вас взаємний VYBE 💜")}
    else if(kind==="super")tg?.showAlert?.("SuperVYBE надіслано ✦")
  }
  index++;renderCard();tg?.HapticFeedback?.impactOccurred("light");
}
$("skipBtn").onclick=()=>next("skip");$("likeBtn").onclick=()=>next("like");$("sparkBtn").onclick=()=>next("super");document.querySelectorAll(".mood").forEach(b=>b.onclick=()=>{document.querySelectorAll(".mood").forEach(x=>x.classList.remove("active"));b.classList.add("active");filter=b.dataset.mood;index=0;renderCard()});
function renderMatches(){
  const list=$("matchesList");
  $("matchCount").textContent=matches.length;
  list.innerHTML=matches.length
    ? matches.map((p,i)=>'<button type="button" class="listItem matchOpen" data-index="'+i+'">'+(p.photo_url?'<img class="avatar avatarPhoto" src="'+escapeHtml(p.photo_url)+'" alt="">':'<div class="avatar">♡</div>')+'<div class="itemMain"><b>'+escapeHtml(p.name)+(p.age?", "+escapeHtml(p.age):"")+(p.verified?' ✓':'')+'</b><small>Взаємний VYBE'+(p.city?" • "+escapeHtml(p.city):"")+(p.online?" • ● онлайн":"")+'</small></div><span>›</span></button>').join("")
    : '<div class="empty">Поки немає взаємних збігів.</div>';
  list.querySelectorAll(".matchOpen").forEach(b=>{
    b.onclick=()=>{
      const p=matches[Number(b.dataset.index)];
      if(!p)return;
      openChat(p.match_id,p.name,p.id);
    };
  });
}
function renderChats(){
  const list=$("chatList");
  const rows=[...matches].sort((a,b)=>new Date(b.last_message_at||0)-new Date(a.last_message_at||0));
  list.innerHTML=rows.length?rows.map((p,i)=>{
    const unread=Number(p.unread_count||0);
    const subtitle=p.last_message?escapeHtml(p.last_message):"Відкрити приватний чат";
    const time=formatChatListTime(p.last_message_at);
    return '<button type="button" class="listItem chatOpen" data-index="'+i+'">'+(p.photo_url?'<img class="avatar avatarPhoto" src="'+escapeHtml(p.photo_url)+'" alt="">':'<div class="avatar">'+escapeHtml((p.name||"V").trim().charAt(0).toUpperCase())+'</div>')+'<div class="itemMain"><b>'+escapeHtml(p.name)+(p.age?", "+escapeHtml(p.age):"")+(p.online?' <span class="onlineMini">●</span>':'')+'</b><small>'+subtitle+'</small></div><div class="chatTail">'+(time?'<small class="chatTime">'+escapeHtml(time)+'</small>':'')+(unread?'<span class="unreadBadge">'+unread+'</span>':'')+'</div><span class="chevron">›</span></button>';
  }).join(""):'<div class="empty">Чати з’являться після взаємних збігів.</div>';
  list.querySelectorAll(".chatOpen").forEach(b=>b.onclick=()=>{
    const p=rows[Number(b.dataset.index)];if(p)openChat(p.match_id,p.name,p.id);
  });
}
async function openChat(matchId,name,userId,options={}){
  const key=String(matchId);
  const previousBox=$("chatMessages");
  const previousDraft=options.preserveDraft&&activeChat?.matchId===key?($("chatMessage")?.value||""):"";
  const stickToBottom=!previousBox||(previousBox.scrollHeight-previousBox.scrollTop-previousBox.clientHeight<90);
  const previousDistance=previousBox?previousBox.scrollHeight-previousBox.scrollTop:0;

  const r=await secureApi("messages_list",{match_id:matchId});
  if(!r.ok){
    if(options.silent){activeChat=null;sheet.classList.add("hidden");await loadMatches();return}
    tg?.showAlert?.("Не вдалося відкрити чат.");return
  }

  activeChat={matchId:key,name,userId:String(userId)};
  syncMatchRealtimeChannels();
  const peerReadAt=r.peer_last_read_at?new Date(r.peer_last_read_at).getTime():0;
  const messages=r.messages||[];
  const msgs=messages.map(m=>{
    const mine=String(m.sender_id)===String(profile?.user_id);
    const sender=mine?"Ти":name;
    const initial=escapeHtml((sender||"V").trim().charAt(0).toUpperCase());
    const createdAt=new Date(m.created_at).getTime();
    const receipt=mine?(peerReadAt&&createdAt<=peerReadAt?"✓✓":"✓"):"";
    const meta=[formatMessageTime(m.created_at),receipt].filter(Boolean).join(" · ");
    return '<div class="msgRow '+(mine?"mine":"theirs")+'"><div class="msgAvatar">'+initial+'</div><div class="msgWrap"><div class="msgSender">'+escapeHtml(sender)+'</div><div class="msgBubble">'+escapeHtml(m.body)+'</div><div class="msgMeta">'+escapeHtml(meta)+'</div></div></div>';
  }).join("");

  content.innerHTML='<div class="chatHeader"><div class="chatAvatar">'+escapeHtml((name||"V").trim().charAt(0).toUpperCase())+'</div><div class="chatTitle"><h2>'+escapeHtml(name)+'</h2><small id="chatPresence">'+chatConnectionLabel()+'</small></div><button id="chatSafetyBtn" class="chatSafety" aria-label="Безпека">⋯</button></div><div id="chatMessages" class="chatMessages">'+(msgs||'<div class="chatEmpty">Почни розмову 👋</div>')+'</div><div class="chatComposer"><textarea id="chatMessage" class="field" maxlength="2000" placeholder="Напиши повідомлення…"></textarea><button id="sendMessage" class="primary">Надіслати</button></div>';
  sheet.classList.remove("hidden");

  const safety=$("chatSafetyBtn");if(safety)safety.onclick=()=>openUserSafety(userId,name);
  const field=$("chatMessage");if(field&&previousDraft)field.value=previousDraft;
  bindTyping(key);

  const box=$("chatMessages");
  if(box){
    if(stickToBottom)box.scrollTop=box.scrollHeight;
    else box.scrollTop=Math.max(0,box.scrollHeight-previousDistance);
  }

  const current=matches.find(x=>String(x.match_id)===key);
  if(current){current.unread_count=0;renderChats()}
  if(!options.noMatchRefresh)loadMatches();

  $("sendMessage").onclick=async()=>{
    const message=$("chatMessage").value.trim();if(!message)return;
    sendTyping(key,false);clearTimeout(typingStopTimer);
    $("sendMessage").disabled=true;
    const x=await secureApi("message_send",{match_id:matchId,message});
    if(!x.ok){$("sendMessage").disabled=false;tg?.showAlert?.("Не вдалося надіслати повідомлення.");return}
    if($("chatMessage"))$("chatMessage").value="";
    await openChat(matchId,name,userId,{noMatchRefresh:true});
    loadMatches();
    tg?.HapticFeedback?.notificationOccurred("success");
  };
}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
document.querySelectorAll(".navItem").forEach(b=>b.onclick=()=>{document.querySelectorAll(".navItem").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));$(b.dataset.target).classList.add("active")});setInterval(renderNow,60000);

function openPrivacyInfo(){
  content.innerHTML='<h2>Приватність 🔐</h2><p>VYBE використовує Telegram-авторизацію та зберігає лише дані, потрібні для роботи сервісу: Telegram ID, анкету, фото, VYBE NOW, лайки, збіги, приватні повідомлення, блокування, скарги та бонуси.</p><p>Фото зберігаються у Supabase Storage. Тексти приватних повідомлень не передаються в Realtime Broadcast — через realtime передаються лише технічні сигнали про зміни.</p><p>Ти можеш видалити акаунт у Налаштуваннях. Після підтвердження профіль і пов’язані дані видаляються з активної бази.</p>';
  sheet.classList.remove("hidden");
}

function openCommunityRules(){
  content.innerHTML='<h2>Правила спільноти 🛡</h2><p>VYBE — лише для повнолітніх 18+.</p><p>Заборонені: примус, шантаж, переслідування, шахрайство, видавання себе за іншу людину, участь неповнолітніх, продаж сексуальних послуг та незаконний контент.</p><p>Для небезпечного або підозрілого профілю використовуй «Поскаржитися» або «Заблокувати».</p>';
  sheet.classList.remove("hidden");
}

function openSupportInfo(){
  content.innerHTML='<h2>Допомога ⚑</h2><p>Якщо проблема стосується конкретного користувача, відкрий його анкету або чат → ⋯ → «Поскаржитися».</p><p>Технічні помилки зараз фіксуємо під час beta-тестування. Не надсилай у скаргах паролі, банківські дані чи інші секрети.</p>';
  sheet.classList.remove("hidden");
}

function resetLocalVYBE(){
  const keys=[];
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);
    if(key&&key.startsWith("vybe"))keys.push(key);
  }
  keys.forEach(key=>localStorage.removeItem(key));
}

async function deleteAccount(){
  const typed=$("deleteConfirmInput")?.value?.trim()||"";
  const button=$("deleteAccountConfirm");
  if(typed!=="ВИДАЛИТИ"){
    tg?.showAlert?.('Для підтвердження введи слово «ВИДАЛИТИ».');
    return;
  }
  if(button){button.disabled=true;button.textContent="Видаляємо…"}
  const r=await secureApi("account_delete",{confirmation:typed});
  if(!r.ok){
    if(button){button.disabled=false;button.textContent="Видалити акаунт назавжди"}
    tg?.showAlert?.("Не вдалося видалити акаунт. Спробуй ще раз.");
    return;
  }
  if(realtimeUserChannel&&realtimeClient){try{realtimeClient.removeChannel(realtimeUserChannel)}catch{}}
  for(const entry of realtimeMatchChannels.values()){try{realtimeClient?.removeChannel(entry.channel)}catch{}}
  realtimeMatchChannels.clear();
  resetLocalVYBE();
  profile=null;now=null;matches=[];remotePeople=[];activeChat=null;
  sheet.classList.add("hidden");
  tg?.HapticFeedback?.notificationOccurred("success");
  if(tg?.showAlert){
    tg.showAlert("Акаунт VYBE та пов’язані дані видалено.",()=>{try{tg.close()}catch{location.reload()}});
  }else{
    alert("Акаунт VYBE та пов’язані дані видалено.");
    location.reload();
  }
}

function openDeleteAccount(){
  content.innerHTML='<h2>Видалити акаунт</h2><p class="dangerText">Ця дія незворотна. Будуть видалені анкета, фото, VYBE NOW, лайки, збіги, повідомлення, блокування, скарги, реферальні дані та бонуси, пов’язані з цим акаунтом.</p><label>Для підтвердження введи <b>ВИДАЛИТИ</b><input id="deleteConfirmInput" class="field" autocomplete="off" maxlength="20" placeholder="ВИДАЛИТИ"></label><button id="deleteAccountConfirm" class="primary dangerPrimary">Видалити акаунт назавжди</button><button id="cancelDeleteAccount" class="choice filterReset">Скасувати</button>';
  sheet.classList.remove("hidden");
  $("deleteAccountConfirm").onclick=deleteAccount;
  $("cancelDeleteAccount").onclick=()=>sheet.classList.add("hidden");
}

function openSettings(){
  content.innerHTML='<h2>Налаштування ⚙</h2><button id="privacyInfoBtn" class="choice safetyChoice">🔐 Приватність</button><button id="communityRulesBtn" class="choice safetyChoice">🛡 Правила спільноти</button><button id="settingsBlockedBtn" class="choice safetyChoice">🚫 Заблоковані користувачі</button><button id="deleteAccountBtn" class="choice safetyChoice dangerChoice">🗑 Видалити акаунт</button><p class="safetyHint">Повне перемикання мови UA/EN готується окремим наступним блоком, щоб не залишати частково перекладений інтерфейс.</p>';
  sheet.classList.remove("hidden");
  $("privacyInfoBtn").onclick=openPrivacyInfo;
  $("communityRulesBtn").onclick=openCommunityRules;
  $("settingsBlockedBtn").onclick=openBlockedUsers;
  $("deleteAccountBtn").onclick=openDeleteAccount;
}

const referralBtn=document.getElementById("referralBtn");if(referralBtn)referralBtn.onclick=openReferral;const blockedUsersBtn=document.getElementById("blockedUsersBtn");if(blockedUsersBtn)blockedUsersBtn.onclick=openBlockedUsers;const supportBtn=document.getElementById("supportBtn");if(supportBtn)supportBtn.onclick=openSupportInfo;
const settingsBtn=document.getElementById("settingsBtn");if(settingsBtn)settingsBtn.onclick=openSettings;
const photoBtn=document.getElementById("photoBtn"),removePhotoBtn=document.getElementById("removePhotoBtn");
if(photoBtn)photoBtn.onclick=()=>{
  const input=document.createElement("input");
  input.type="file";
  input.accept="image/jpeg,image/png,image/webp";
  input.onchange=async()=>{const file=input.files?.[0];if(file)await uploadProfilePhoto(file)};
  input.click();
};
if(removePhotoBtn)removePhotoBtn.onclick=removeProfilePhoto;
