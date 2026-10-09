/* Optional first-use milestones. Only booleans are stored, scoped to the authenticated VYBE user. */
(()=>{
  "use strict";
  function create({document:d=document,getState,getLang=()=>"uk",onAction=()=>{},onError=()=>{},capture=()=>{}}){
    const root=d.getElementById("startGuide"),entry=d.getElementById("startGuideBtn");
    if(!root||!entry)return null;
    root.innerHTML='<details class="startGuideDetails"><summary class="startGuideSummary"><span class="startGuideHeading"></span><span class="startGuideCount"></span><span class="startGuideChevron" aria-hidden="true">⌄</span></summary><div class="startGuideBody"><p class="startGuideIntro"></p><ol class="startGuideSteps"><li data-step="interests"><span class="startGuideMark" aria-hidden="true"></span><span></span><small></small></li><li data-step="vibe"><span class="startGuideMark" aria-hidden="true"></span><span></span><small></small></li><li data-step="conversation"><span class="startGuideMark" aria-hidden="true"></span><span></span><small></small></li></ol><div class="startGuideNext"><b></b><p></p><button type="button" class="primary startGuideAction"></button></div><button type="button" class="textBtn startGuideDismiss"></button></div></details>';
    const details=root.querySelector("details"),summary=root.querySelector("summary"),button=root.querySelector(".startGuideAction");
    let userId=null,progress={},forceVisible=false,busy=false,action=null,revision=0;
    const key=()=>"vybeStartGuide:v1:"+userId;
    const read=()=>{
      let value={};
      try{value=JSON.parse(d.defaultView.localStorage.getItem(key()))||{}}catch{}
      return Object.fromEntries(["interests","vibe","conversation","hidden"].map(k=>[k,value[k]===true]));
    };
    const persist=()=>{try{d.defaultView.localStorage.setItem(key(),JSON.stringify(progress))}catch{}};
    const text=(uk,en)=>getLang()==="en"?en:uk;
    function refresh(){
      const s=getState();
      if(!s?.eligible||!s.userId){root.hidden=true;entry.hidden=true;return}
      const nextId=String(s.userId);
      if(userId!==nextId){userId=nextId;progress=read();forceVisible=false;busy=false;details.open=false;revision++}
      let changed=false;
      for(const name of ["interests","vibe","conversation"]){
        if(s[name]===true&&progress[name]!==true){progress[name]=true;changed=true}
      }
      if(changed)persist();
      const count=["interests","vibe","conversation"].filter(k=>progress[k]).length;
      const hadFocus=root.contains(d.activeElement);
      entry.hidden=false;
      root.hidden=progress.hidden===true||(count===3&&!forceVisible);
      if(root.hidden&&hadFocus)entry.focus({preventScroll:true});
      root.querySelector(".startGuideHeading").textContent=text("Старт у VYBE","Start in VYBE");
      root.querySelector(".startGuideCount").textContent=text(count+" з 3",count+" of 3");
      root.querySelector(".startGuideIntro").textContent=text("Три кроки до знайомства. Обирай свій темп — це підказки, а не обов’язкові завдання.","Three steps to meeting someone. Go at your own pace — these are suggestions, not requirements.");
      const labels={interests:text("Обери інтереси","Choose interests"),vibe:text("Увімкни свій VYBE NOW","Set your VYBE NOW"),conversation:text("Почни першу розмову","Start a conversation")};
      for(const row of root.querySelectorAll("[data-step]")){
        const done=progress[row.dataset.step]===true;
        row.classList.toggle("isDone",done);
        row.querySelector(".startGuideMark").textContent=done?"✓":String([...row.parentNode.children].indexOf(row)+1);
        row.children[1].textContent=labels[row.dataset.step];
        row.querySelector("small").textContent=done?text("Готово","Done"):text("Попереду","Next");
      }
      let title,hint,label;
      if(count===3){
        action="chats";title=text("Знайомство вже почалося","You’ve made a start");hint=text("Продовжуй розмову або запропонуй VYBE-дует у чаті.","Continue the conversation or try VYBE Duet in a chat.");label=text("Відкрити чати","Open chats");
      }else if(!progress.interests){
        action="interests";title=text("Знайди спільні теми","Find common ground");hint=text("Додай те, що тобі подобається. Інтереси видно в анкеті й можна використати у пошуку.","Add what you enjoy. Interests appear in your profile and can help with discovery.");label=text("Обрати інтереси","Choose interests");
      }else if(!s.activeVibe){
        action="vibe";title=text("Покажи свій настрій","Show your mood");hint=text("Активний VYBE NOW показує твою анкету людям, які шукають такий вайб.","An active VYBE NOW makes your profile available to people looking for that vibe.");label=text("Задати VYBE NOW","Set VYBE NOW");
      }else if(!s.matchesReady){
        action="refresh_matches";title=text("Перевір свої збіги","Check your matches");hint=text("Онови список, щоб побачити, з ким уже можна поговорити.","Refresh your matches to see who you can already talk to.");label=text("Оновити збіги","Refresh matches");
      }else if(s.hasMatch){
        action="chats";title=text("У вас уже взаємний VYBE","You already have a mutual VYBE");hint=text("Обери діалог, привітайся або запроси людину у VYBE-дует.","Choose a chat, say hello or invite them to VYBE Duet.");label=text("Відкрити чати","Open chats");
      }else if(s.discoveryStatus!=="ready"){
        action="refresh_discovery";title=text("Перевір людей поруч із твоїм вайбом","Find people with your vibe");hint=text("Онови пошук, щоб побачити доступні анкети.","Refresh discovery to see available profiles.");label=text("Оновити пошук","Refresh discovery");
      }else if(s.hasPeople){
        action="discover";title=text("Знайди взаємний VYBE","Find a mutual VYBE");hint=text("Переглянь анкети. Надішли VYBE людині, яка тобі цікава — взаємний вибір відкриє чат.","Browse profiles. Send VYBE to someone you like — a mutual choice opens a chat.");label=text("Переглянути людей","Browse people");
      }else if(s.hasFilters){
        action="reset_filters";title=text("Розшир пошук","Broaden discovery");hint=text("За цими фільтрами анкет поки немає. Спробуй пошук без додаткових умов.","No profiles match these filters yet. Try discovery without extra filters.");label=text("Скинути фільтри","Reset filters");
      }else{
        action="invite";title=text("Знайомитися цікавіше разом","Meeting people is better together");hint=text("Активних анкет поки немає. Можеш поділитися запрошенням у VYBE.","No active profiles yet. You can share an invitation to VYBE.");label=text("Запросити друга","Invite a friend");
      }
      root.querySelector(".startGuideNext b").textContent=title;
      root.querySelector(".startGuideNext p").textContent=hint;
      button.textContent=busy?text("Зачекай…","Please wait…"):label;
      button.disabled=busy;
      root.querySelector(".startGuideDismiss").textContent=text("Сховати підказки","Hide suggestions");
    }
    function show(){
      refresh();if(entry.hidden)return;
      progress.hidden=false;forceVisible=true;persist();refresh();details.open=true;
      summary.focus({preventScroll:true});root.scrollIntoView?.({block:"start",behavior:"smooth"});
    }
    button.addEventListener("click",async()=>{
      if(busy||root.hidden||!action)return;
      const selected=action,requestRevision=revision;
      busy=true;refresh();capture("start_guide_action",{action:selected});
      try{await onAction(selected)}catch(error){onError(error)}finally{if(revision===requestRevision){busy=false;refresh()}}
    });
    root.querySelector(".startGuideDismiss").addEventListener("click",()=>{
      progress.hidden=true;persist();refresh();entry.focus({preventScroll:true});capture("start_guide_hidden");
    });
    details.addEventListener("toggle",()=>{if(details.open&&!root.hidden)capture("start_guide_opened")});
    refresh();
    return {refresh,show};
  }
  window.VybeStartGuide={create};
})();
