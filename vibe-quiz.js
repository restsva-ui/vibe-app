(function(root){
  "use strict";
  const types=Object.freeze({
    spark:{uk:"Іскра",en:"Spark",color:"#ed9fba",ukText:"Тобі близькі флірт, грайливість і живі емоції.",enText:"You enjoy flirting, playfulness and lively emotions."},
    explorer:{uk:"Мандрівник",en:"Explorer",color:"#91cbbb",ukText:"Нові місця й маленькі пригоди зближують тебе з людьми.",enText:"New places and little adventures bring you closer to people."},
    cozy:{uk:"Затишок",en:"Cozy",color:"#ddbc85",ukText:"Цінуєш турботу, спокій і теплі моменти разом.",enText:"You value care, calm and warm moments together."},
    talker:{uk:"Співрозмовник",en:"Talker",color:"#bda6ee",ukText:"Твій вайб — цікаві розмови та уважність одне до одного.",enText:"Your vibe is thoughtful conversations and listening to each other."}
  });
  const order=Object.keys(types);
  const questions=[
    {uk:"Як виглядає твоє ідеальне знайомство?",en:"What does your ideal first meetup look like?",options:[
      ["spark","Флірт і багато сміху","Flirting and lots of laughter"],
      ["explorer","Прогулянка новим маршрутом","A walk somewhere new"],
      ["cozy","Кава в затишному місці","Coffee in a cozy place"],
      ["talker","Розмова, яку не хочеться завершувати","A conversation you don't want to end"]]},
    {uk:"Що найбільше приваблює тебе в людині?",en:"What attracts you most in someone?",options:[
      ["talker","Уміння слухати й цікаві думки","Listening and interesting ideas"],
      ["cozy","Турбота та надійність","Care and reliability"],
      ["spark","Харизма та почуття гумору","Charisma and a sense of humor"],
      ["explorer","Відкритість до нового","Being open to new experiences"]]},
    {uk:"Вільний вечір удвох. Що обереш?",en:"A free evening together. What would you choose?",options:[
      ["explorer","Спонтанну маленьку пригоду","A spontaneous little adventure"],
      ["talker","Обмін історіями та улюбленою музикою","Sharing stories and favorite music"],
      ["cozy","Фільм, плед і щось смачне","A movie, a blanket and good food"],
      ["spark","Гру, жарти й легкий флірт","A game, jokes and some flirting"]]},
    {uk:"Яке повідомлення змусить тебе усміхнутися?",en:"Which message would make you smile?",options:[
      ["cozy","«Як твій день? Я поруч»","“How was your day? I'm here”"],
      ["spark","«Здається, у нас небезпечна хімія 😉»","“I think we have dangerous chemistry 😉”"],
      ["talker","«Хочу почути твою думку про це»","“I'd love to hear your thoughts on this”"],
      ["explorer","«Знайшов цікаве місце. Ходімо?»","“Found an interesting place. Shall we go?”"]]},
    {uk:"Що хочеться принести у знайомство?",en:"What would you like to bring to a connection?",options:[
      ["talker","Взаємне розуміння","Mutual understanding"],
      ["explorer","Нові враження","New experiences"],
      ["spark","Енергію та грайливість","Energy and playfulness"],
      ["cozy","Тепло та підтримку","Warmth and support"]]}
  ];
  function validType(value){return typeof value==="string"&&Object.hasOwn(types,value);}
  function parseStart(value){
    if(typeof value!=="string")return null;
    const m=value.trim().toLowerCase().match(/^qz_(spark|explorer|cozy|talker)(?:_(v[0-9a-z]{1,14}))?$/);
    return m?{type:m[1],referral:m[2]||null}:null;
  }
  function fromLaunch(href,telegram){
    let params=new URLSearchParams();try{params=new URL(href).searchParams;}catch{}
    const signed=new URLSearchParams(telegram?.initData||"").get("start_param");
    const start=signed||telegram?.initDataUnsafe?.start_param||params.get("tgWebAppStartParam")||params.get("start_param");
    if(start)return parseStart(start);
    const type=params.get("quiz"),referral=params.get("ref");
    return validType(type)?{type,referral:/^v[0-9a-z]{1,14}$/.test(referral||"")?referral:null}:null;
  }
  function calculate(answers){
    if(!Array.isArray(answers)||answers.length!==questions.length||Array.from(answers).some(x=>!validType(x)))return null;
    const counts=Object.fromEntries(order.map(key=>[key,0]));for(const answer of answers)counts[answer]++;
    const best=Math.max(...Object.values(counts));
    // Ties follow the user's first relevant choice, not an arbitrary alphabet order.
    return answers.find(answer=>counts[answer]===best);
  }
  function imageUrl(type,language,base=root.location?.href){
    if(!validType(type))return null;
    return new URL("./assets/vybe-quiz-"+type+"-"+(language==="en"?"en":"uk")+".jpg?v=20261011-quiz1",base).href;
  }
  function create({document=root.document,api,telegram,getLang,getUserId,allowed,capture=()=>{},onFind=()=>{}}){
    let target=null,epoch=0,answers=[],position=0,result=null,invited=null,busy=false;
    const tr=(uk,en)=>getLang()==="en"?en:uk;
    const escape=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
    const storageKey=()=>{const id=getUserId();return typeof id==="string"&&/^[a-z0-9_-]{1,80}$/i.test(id)?"vybeQuiz:v1:"+id:null;};
    const mounted=e=>e===epoch&&target?.isConnected&&allowed();
    const find=id=>target?.querySelector("#"+id);
    function dispose(){epoch++;target=null;busy=false;answers=[];position=0;result=null;invited=null;}
    function clear(userId){try{root.localStorage.removeItem("vybeQuiz:v1:"+userId);}catch{}}
    function save(){try{const key=storageKey();if(key)root.localStorage.setItem(key,JSON.stringify({type:result}));}catch{}}
    function notice(message){const el=find("quizNotice");if(el)el.textContent=message;}
    function updateBusy(value){busy=value;target?.querySelectorAll("[data-quiz-share]").forEach(b=>b.disabled=value);}
    function focusHeading(){find("quizHeading")?.focus({preventScroll:true});const card=target?.closest(".sheetCard");if(card)card.scrollTop=0;}
    function render(){
      if(!mounted(epoch))return;
      const intro='<div class="quizEyebrow">VYBE · '+tr("МІНІГРА","MINI GAME")+'</div>';
      if(result){
        const info=types[result],lang=getLang()==="en"?"en":"uk";
        const comparison=invited?(invited===result?tr("У вас однаковий вайб. Уже є тема для першої розмови!","You share a vibe. There's your first conversation starter!"):tr("У друга — ","Your friend's vibe is ")+types[invited][lang]+tr(". Різні результати — привід познайомитися ближче.",". Different results give you something to talk about.")):"";
        target.innerHTML=intro+'<h2 id="quizHeading" tabindex="-1">'+tr("Твій вайб — ","Your vibe is ")+escape(info[lang])+'</h2><img class="quizResultCard" src="'+escape(imageUrl(result,lang))+'" alt="'+escape(info[lang]+". "+info[lang+"Text"])+'" width="900" height="1200">'+(comparison?'<p class="quizComparison">'+escape(comparison)+'</p>':'')+'<div class="quizActions"><button id="quizShare" data-quiz-share="message" type="button" class="primary">'+tr("Поділитися карткою","Share my card")+'</button><button id="quizCopy" data-quiz-share="copy" type="button" class="choice">'+tr("Скопіювати запрошення","Copy invitation")+'</button>'+(typeof telegram?.shareToStory==="function"&&telegram.isVersionAtLeast?.("7.8")!==false?'<button id="quizStory" data-quiz-share="story" type="button" class="choice">'+tr("У Stories","To Stories")+'</button>':'')+'</div><p id="quizNotice" class="quizNotice" role="status"></p><div class="quizFooter"><button id="quizRetake" type="button">'+tr("Пройти ще раз","Try again")+'</button><button id="quizFind" type="button">'+tr("До знайомств →","Meet people →")+'</button></div>';
        target.querySelectorAll("[data-quiz-share]").forEach(button=>button.onclick=()=>share(button.dataset.quizShare));
        find("quizRetake").onclick=()=>{epoch++;answers=[];position=0;result=null;busy=false;capture("vibe_quiz_started",{retake:true});render();};
        find("quizFind").onclick=()=>{dispose();onFind();};
      }else{
        const q=questions[position],selected=answers[position];
        target.innerHTML=intro+'<div class="quizProgress"><span>'+tr("Запитання ","Question ")+(position+1)+' / '+questions.length+'</span><span>'+tr("Близько хвилини","About a minute")+'</span></div><progress class="quizProgressBar" max="'+questions.length+'" value="'+position+'" aria-label="'+tr("Прогрес тесту","Quiz progress")+'"></progress><h2 id="quizHeading" tabindex="-1">'+escape(q[getLang()==="en"?"en":"uk"])+'</h2><fieldset class="quizOptions"><legend class="visuallyHidden">'+tr("Обери одну відповідь","Choose one answer")+'</legend>'+q.options.map(([key,uk,en])=>'<label class="quizOption"><input type="radio" name="vibeQuizAnswer" value="'+key+'" '+(selected===key?'checked':'')+'><span>'+escape(tr(uk,en))+'</span></label>').join("")+'</fieldset><div class="quizQuestionActions"><button id="quizBack" type="button" class="choice" '+(position===0?'disabled':'')+'>'+tr("Назад","Back")+'</button><button id="quizNext" type="button" class="primary" '+(!selected?'disabled':'')+'>'+tr(position===questions.length-1?"Мій результат":"Далі",position===questions.length-1?"My result":"Next")+'</button></div><p class="quizHint">'+tr("Обирай те, що ближче зараз. Це гра про настрій.","Choose what feels right now. This is a game about your mood.")+'</p>';
        const renderedPosition=position;
        target.querySelectorAll('input[name="vibeQuizAnswer"]').forEach(input=>input.onchange=()=>{if(!mounted(epoch)||position!==renderedPosition)return;answers[position]=input.value;find("quizNext").disabled=false;telegram?.HapticFeedback?.selectionChanged?.();});
        find("quizBack").onclick=()=>{if(position>0){position--;render();}};
        find("quizNext").onclick=()=>{if(!mounted(epoch)||position!==renderedPosition||!validType(answers[position]))return;position++;if(position===questions.length){result=calculate(answers);save();capture("vibe_quiz_completed",{result});}render();};
      }
      updateBusy(busy);focusHeading();
    }
    function safeShare(data){
      if(!data?.ok||typeof data.url!=="string"||typeof data.photo_url!=="string"||typeof data.text!=="string")return false;
      try{
        const url=new URL(data.url),photo=new URL(data.photo_url);
        const launch=parseStart(url.searchParams.get("start"));
        return url.origin==="https://t.me"&&url.pathname==="/vybe_now_bot"&&launch?.type===result&&!!launch.referral&&photo.origin==="https://restsva-ui.github.io"&&photo.pathname==="/vibe-app/assets/vybe-quiz-"+result+"-"+(getLang()==="en"?"en":"uk")+".jpg";
      }catch{return false;}
    }
    async function share(mode){
      if(busy||!mounted(epoch)||!validType(result))return;
      const e=epoch,type=result,native=mode==="message"&&typeof telegram?.shareMessage==="function"&&telegram.isVersionAtLeast?.("8.0")!==false;
      updateBusy(true);notice("");capture("vibe_quiz_share_requested",{result:type,method:mode});
      let nativePending=false;
      try{
        const data=await api("vibe_quiz_share",{type,language:getLang()==="en"?"en":"uk",native});
        if(!mounted(e))return;
        if(!safeShare(data))throw new Error("invalid_share");
        if(mode==="copy"){
          try{await root.navigator.clipboard.writeText(data.url);if(mounted(e)){notice(tr("Запрошення скопійовано ✅","Invitation copied ✅"));capture("vibe_quiz_link_copied",{result:type});}}
          catch{if(mounted(e))notice(data.url);}
        }else if(mode==="story"){
          telegram.shareToStory(data.photo_url,{text:data.text+"\n"+data.url,...(telegram.initDataUnsafe?.user?.is_premium?{widget_link:{url:data.url,name:tr("Мій вайб у VYBE","My VYBE")}}:{})});
          capture("vibe_quiz_story_editor_opened",{result:type});
        }else if(native&&data.prepared_id){
          nativePending=true;
          try{telegram.shareMessage(data.prepared_id,sent=>{if(mounted(e)){updateBusy(false);if(sent===true){notice(tr("Картку надіслано ✅","Card shared ✅"));capture("vibe_quiz_shared",{result:type});}}});}
          catch{nativePending=false;throw new Error("native_failed");}
        }else{
          const url="https://t.me/share/url?url="+encodeURIComponent(data.url)+"&text="+encodeURIComponent(data.text);
          if(telegram?.openTelegramLink)telegram.openTelegramLink(url);
          else{const a=document.createElement("a");a.href=url;a.target="_blank";a.rel="noopener noreferrer";a.textContent=tr("Відкрити поширення в Telegram","Open sharing in Telegram");find("quizNotice").appendChild(a);}
          capture("vibe_quiz_share_dialog_opened",{result:type});
        }
      }catch{if(mounted(e))notice(tr("Не вдалося поділитися. Спробуй ще раз або скопіюй запрошення.","Could not share. Try again or copy the invitation."));}
      finally{if(mounted(e)&&!nativePending)updateBusy(false);}
    }
    function open(element,{invitedType=null}={}){
      dispose();if(!allowed()||!element?.isConnected)return false;
      target=element;target.classList.add("vibeQuiz");invited=validType(invitedType)?invitedType:null;
      if(!invited){try{const saved=JSON.parse(root.localStorage.getItem(storageKey())||"null");if(validType(saved?.type))result=saved.type;}catch{}}
      capture(result?"vibe_quiz_result_opened":"vibe_quiz_started",{invited:!!invited});render();return true;
    }
    return {open,dispose,clear,isMounted:()=>!!target?.isConnected,refresh:render};
  }
  const api={types,questions,validType,parseStart,fromLaunch,calculate,imageUrl,create};root.VybeQuiz=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
