const tg=window.Telegram?.WebApp;if(tg){tg.ready();tg.expand();tg.setHeaderColor("#0b0b12");tg.setBackgroundColor("#0b0b12")}const tuser=tg?.initDataUnsafe?.user;const $=id=>document.getElementById(id),store=(k,v)=>localStorage.setItem(k,JSON.stringify(v)),load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};

const SUPABASE_URL="https://qifxxzpnuxchnkowxzgp.supabase.co";
const SUPABASE_KEY="sb_publishable_a-yy3lcgCXbDJosdQAWbPQ_bRLnN_LF";
const TELEGRAM_AUTH_URL=SUPABASE_URL+"/functions/v1/telegram-auth";

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

let profile=load("vybeProfile",null),now=load("vybeNow",null),matches=[],index=0,filter="Усе",remotePeople=[];localStorage.removeItem("vybeMatches");
const demoPeople=[{id:"demo1",name:"Аліна",age:28,intent:"Флірт",icon:"🔥",bio:"Сьогодні хочу легке спілкування без банальних «привіт, як справи?»",meta:"Демо • онлайн",img:"https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=85"}];
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
  const r=await secureApi("discover");if(!r.ok)return;
  remotePeople=(r.people||[]).map(p=>({id:p.user_id,name:p.name||"VYBE",age:p.age||18,intent:p.intent||"Поговорити",icon:intentIcon(p.intent),bio:p.bio||"Новий користувач VYBE",meta:(p.city||"VYBE")+" • реальна анкета",img:null}));
  index=0;renderCard();
}
async function hydrateProfile(){
  const r=await secureApi("profile_get");if(!r.ok)return;
  if(r.profile){profile={name:r.profile.name,age:r.profile.age,city:r.profile.city||"",gender:r.profile.gender||"",looking:r.profile.looking_for||"",bio:r.profile.bio||"",user_id:r.user_id};store("vybeProfile",profile)}
}
async function begin(){
  const auth=await verifyTelegramAuth();window.__vybeAuth=auth;
  if(!auth?.ok){console.warn("VYBE secure auth not confirmed",auth);tg?.showAlert?.("Не вдалося підтвердити Telegram-авторизацію. Відкрий VYBE заново через бота.");return}
  await claimReferral();
  await hydrateProfile();
  if(!profile)showOnboarding();else{renderProfile();await syncProfile();await loadPeople()}
  await loadMatches();renderNow();renderCard();renderMatches();renderChats();
}
const age=$("ageConfirm");age.onchange=()=>$("enterBtn").disabled=!age.checked;$("enterBtn").onclick=()=>{localStorage.setItem("vybe18","yes");$("ageGate").classList.add("hidden");begin()};if(localStorage.getItem("vybe18")==="yes"){$("ageGate").classList.add("hidden");setTimeout(begin,0)}
function showOnboarding(){const o=$("onboarding");o.classList.remove("hidden");$("obName").value=profile?.name||tuser?.first_name||"";$("obAge").value=profile?.age||"";$("obCity").value=profile?.city||"";$("obGender").value=profile?.gender||"";$("obLooking").value=profile?.looking||"";$("obBio").value=profile?.bio||""}
$("saveProfile").onclick=async()=>{const age=+$("obAge").value;if(!$("obName").value.trim()||age<18||age>99){tg?.showAlert?.("Вкажи ім’я та вік 18+.");return}profile={...profile,name:$("obName").value.trim(),age,city:$("obCity").value.trim(),gender:$("obGender").value.trim(),looking:$("obLooking").value.trim(),bio:$("obBio").value.trim()};store("vybeProfile",profile);$("onboarding").classList.add("hidden");renderProfile();await syncProfile();await loadPeople();tg?.HapticFeedback?.notificationOccurred("success")};
$("editProfile").onclick=showOnboarding;
function renderProfile(){if(!profile)return;$("profileName").textContent=profile.name+", "+profile.age;$("profileMeta").textContent=[profile.city,profile.gender,profile.looking&&"Шукаю: "+profile.looking].filter(Boolean).join(" • ");$("profileBio").textContent=profile.bio||"Без опису"}
function validNow(){return now&&now.expires>Date.now()}
function renderNow(){if(!validNow()){now=null;localStorage.removeItem("vybeNow");$("nowLabel").textContent="⚡ VYBE NOW не задано";$("nowTime").textContent="Покажи, чого хочеш саме зараз";return}$("nowLabel").textContent=now.icon+" "+now.intent;$("nowTime").textContent="Активний ще "+Math.max(1,Math.ceil((now.expires-Date.now())/3600000))+" год."}
const sheet=$("sheet"),content=$("sheetContent");$("closeSheet").onclick=()=>sheet.classList.add("hidden");
function openSheet(type){let h="";if(type==="now")h='<h2>Твій VYBE NOW ⚡</h2><p>Що ти хочеш саме зараз?</p><div class="choiceGrid">'+[["💬","Поговорити"],["🔥","Флірт"],["🌙","Вірт"],["🫶","Дружба"],["🎙","Голос"],["☕","Зустріч"]].map(x=>'<button class="choice" data-intent="'+x[1]+'" data-icon="'+x[0]+'">'+x[0]+" "+x[1]+"</button>").join("")+'</div><p>На скільки?</p><div class="choiceGrid"><button class="choice duration selected" data-hours="1">1 година</button><button class="choice duration" data-hours="3">3 години</button><button id="smartDuration" class="choice duration" data-smart="1">До ранку</button></div><button id="saveNow" class="primary">Увімкнути VYBE NOW</button>';else if(type==="premium")h='<h2>VYBE+</h2><p>Telegram Stars підключимо після захищеної серверної авторизації.</p><div class="priceGrid"><div class="price"><span>VYBE+ / місяць</span><strong>299 ★</strong></div><div class="price"><span>Spotlight 30 хв</span><strong>49 ★</strong></div><div class="price"><span>5 SuperVYBE</span><strong>79 ★</strong></div></div>';else if(type==="filter")h='<h2>Фільтри</h2><p>Вік, місто, дистанція, кого шукаєш, онлайн та верифікація — наступний етап.</p><button class="primary" onclick="document.getElementById(\'sheet\').classList.add(\'hidden\')">Готово</button>';else h='<h2>Безпека 🛡</h2><p>Тільки 18+. Перед публічним запуском додамо захищену Telegram-авторизацію, блокування та скарги.</p>';content.innerHTML=h;sheet.classList.remove("hidden");if(type==="now"){let chosen=null,hours=1;
const smart=content.querySelector("#smartDuration");
if(smart){const d=new Date(),hour=d.getHours();let target=new Date(d);
if(hour<8){target.setHours(8,0,0,0);smart.textContent="До ранку";}
else if(hour<18){target.setHours(20,0,0,0);smart.textContent="До вечора";}
else{target.setDate(target.getDate()+1);target.setHours(8,0,0,0);smart.textContent="До ранку";}
smart.dataset.until=String(target.getTime());}content.querySelectorAll(".choice[data-intent]").forEach(b=>b.onclick=()=>{content.querySelectorAll(".choice[data-intent]").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");chosen={intent:b.dataset.intent,icon:b.dataset.icon}});content.querySelectorAll(".duration").forEach(b=>b.onclick=()=>{content.querySelectorAll(".duration").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");hours=b.dataset.smart?Math.max(1,(Number(b.dataset.until)-Date.now())/3600000):+b.dataset.hours});$("saveNow").onclick=async()=>{if(!chosen){tg?.showAlert?.("Спочатку обери свій вайб.");return}now={...chosen,expires:Date.now()+hours*3600000};store("vybeNow",now);renderNow();await syncNow(hours);sheet.classList.add("hidden");tg?.HapticFeedback?.notificationOccurred("success")}}}
$("setNow").onclick=()=>openSheet("now");$("premiumBtn").onclick=()=>openSheet("premium");$("filterBtn").onclick=()=>openSheet("filter");$("safetyBtn").onclick=()=>openSheet("safety");
function people(){return remotePeople.length?remotePeople:demoPeople}function filtered(){const arr=people();return filter==="Усе"?arr:arr.filter(p=>p.intent===filter)}
function renderCard(){const arr=filtered();if(!arr.length||index>=arr.length){$("cardStack").innerHTML='<div class="empty">Анкет за цим вайбом поки немає.<br>Спробуй інший фільтр.</div>';return}const p=arr[index];const visual=p.img?'<img src="'+p.img+'" alt="'+p.name+'">':'<div class="generatedAvatar">'+(p.name?.[0]||"V")+'</div>';$("cardStack").innerHTML='<article class="personCard">'+visual+'<div class="gradient"></div><div class="personMeta"><div class="nameRow"><h2>'+p.name+", "+p.age+'</h2></div><div class="intent">'+p.icon+" "+p.intent+'</div><p class="bio">'+p.bio+'</p><div class="meta">'+p.meta+"</div></div></article>"}
async function loadMatches(){
  const r=await secureApi("matches");if(!r.ok)return false;
  matches=(r.matches||[]).map(m=>({match_id:m.match_id,id:m.user_id,name:m.profile?.name||"VYBE",age:m.profile?.age||"",city:m.profile?.city||"",bio:m.profile?.bio||"",icon:"♡"}));
  renderMatches();renderChats();return true;
}
async function next(kind){
  const arr=filtered(),p=arr[index];
  if(kind==="like"&&p){
    if(String(p.id).startsWith("demo")){tg?.showAlert?.("Це демо-анкета. Реальний лайк працює тільки для реальних користувачів.");return}
    const r=await secureApi("like",{target_user_id:p.id,kind:"like"});
    if(!r.ok){tg?.showAlert?.("Не вдалося поставити лайк. Спробуй ще раз.");return}
    if(r.matched){await loadMatches();tg?.HapticFeedback?.notificationOccurred("success");tg?.showAlert?.("У вас взаємний VYBE 💜")}
  }
  index++;renderCard();tg?.HapticFeedback?.impactOccurred("light");
}
$("skipBtn").onclick=()=>next("skip");$("likeBtn").onclick=()=>next("like");$("sparkBtn").onclick=()=>openSheet("premium");document.querySelectorAll(".mood").forEach(b=>b.onclick=()=>{document.querySelectorAll(".mood").forEach(x=>x.classList.remove("active"));b.classList.add("active");filter=b.dataset.mood;index=0;renderCard()});
function renderMatches(){$("matchCount").textContent=matches.length;$("matchesList").innerHTML=matches.length?matches.map(p=>'<div class="listItem" data-match="'+p.match_id+'"><div class="avatar">♡</div><div class="itemMain"><b>'+p.name+(p.age?", "+p.age:"")+'</b><small>Взаємний VYBE'+(p.city?" • "+p.city:"")+'</small></div><span>›</span></div>').join(""):'<div class="empty">Поки немає взаємних збігів.</div>'}
function renderChats(){$("chatList").innerHTML=matches.length?matches.map(p=>'<button class="listItem chatOpen" data-match="'+p.match_id+'" data-name="'+String(p.name).replace(/"/g,"&quot;")+'"><div class="avatar">✉</div><div class="itemMain"><b>'+p.name+'</b><small>Відкрити приватний чат</small></div><span>›</span></button>').join(""):'<div class="empty">Чати з’являться після взаємних збігів.</div>';$("chatList").querySelectorAll(".chatOpen").forEach(b=>b.onclick=()=>openChat(b.dataset.match,b.dataset.name))}
async function openChat(matchId,name){
  const r=await secureApi("messages_list",{match_id:matchId});if(!r.ok){tg?.showAlert?.("Не вдалося відкрити чат.");return}
  const msgs=(r.messages||[]).map(m=>'<div style="padding:8px 0"><b>'+(String(m.sender_id)===String(profile?.user_id)?"Ти":name)+':</b> '+escapeHtml(m.body)+'</div>').join("");
  content.innerHTML='<h2>'+escapeHtml(name)+'</h2><div style="max-height:45vh;overflow:auto;margin:12px 0">'+(msgs||'<p>Почни розмову 👋</p>')+'</div><textarea id="chatMessage" class="field" maxlength="2000" placeholder="Напиши повідомлення…"></textarea><button id="sendMessage" class="primary">Надіслати</button>';
  sheet.classList.remove("hidden");
  $("sendMessage").onclick=async()=>{const message=$("chatMessage").value.trim();if(!message)return;const x=await secureApi("message_send",{match_id:matchId,message});if(!x.ok){tg?.showAlert?.("Не вдалося надіслати повідомлення.");return}await openChat(matchId,name);tg?.HapticFeedback?.notificationOccurred("success")};
}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
document.querySelectorAll(".navItem").forEach(b=>b.onclick=()=>{document.querySelectorAll(".navItem").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));$(b.dataset.target).classList.add("active")});setInterval(renderNow,60000);
const referralBtn=document.getElementById("referralBtn");if(referralBtn)referralBtn.onclick=openReferral;
