/* Private answers stay on the server; analytics never receive answers or guesses. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.VybeDuet=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const mark='<svg class="duetMark" viewBox="0 0 36 36" aria-hidden="true"><circle cx="13" cy="18" r="10" fill="none" stroke="currentColor"/><circle cx="23" cy="18" r="10" fill="none" stroke="currentColor"/></svg>';
  function create(ctx){
    const d=ctx.document,w=d.defaultView;
    let matchId=null,data=null,overlay=null,button=null,timer=null,epoch=0,serial=0,busy=false,lastRead=0,error='',selection={choice:null,guess:null},questionKey='',previousFocus=null,background=[];
    const t=(uk,en)=>ctx.getLang?.()==='en'?en:uk;
    const text=value=>typeof value==='string'?value:value?.[ctx.getLang?.()==='en'?'en':'uk']||value?.uk||'';
    const available=()=>!!matchId&&ctx.getChat?.()?.matchId===matchId&&ctx.isChatVisible?.()!==false&&button?.isConnected;
    const capture=(event,props={})=>ctx.capture?.(event,props);
    function close(){
      if(!overlay)return false;
      overlay.remove();overlay=null;
      for(const [node,value] of background){if(value===null)node.removeAttribute('inert');else node.setAttribute('inert',value);}background=[];
      if(previousFocus?.isConnected)previousFocus.focus();
      return true;
    }
    function dispose(){epoch++;serial++;close();w.clearTimeout(timer);timer=null;button?.parentElement?.remove();button=null;matchId=null;data=null;busy=false;error='';questionKey='';selection={choice:null,guess:null};}
    function label(){
      if(!button)return;
      let value=t('3 запитання · зіграйте удвох','3 questions · play together');
      if(data?.state==='invited')value=t('Тебе запрошують зіграти','You are invited to play');
      if(data?.state==='playing')value=t('Продовжити · ','Continue · ')+data.my_progress+'/3';
      if(data?.state==='waiting')value=t('Твої відповіді збережено · чекаємо другого учасника','Your answers are saved · waiting for your partner');
      if(data?.state==='completed')value=t('Відкрити ваш результат','See your results');
      button.querySelector('small').textContent=value;
    }
    function schedule(){
      w.clearTimeout(timer);
      if(!available())return;
      timer=w.setTimeout(async()=>{if(available()&&!d.hidden)await refresh();schedule();},overlay?15000:60000);
    }
    const footer=()=>'<p class="duetHint">'+esc(t('Відповіді відкриються, коли обидва завершать гру.','Answers open when both of you finish.'))+'</p>';
    const primary=(id,uk,en)=>'<button id="'+id+'" class="duetPrimary" type="button"'+(busy?' disabled':'')+'>'+esc(t(uk,en))+'</button>';
    function render(){
      label();if(!overlay)return;
      const panel=overlay.querySelector('.duetBody');
      const focused=panel.contains(d.activeElement)?d.activeElement:null;
      const focusId=focused?.id,focusKind=focused?.dataset.kind,focusValue=focused?.dataset.value;
      let h='';
      if(!data){h='<h2>'+esc(t('Знайомство починається з гри','A connection starts with a game'))+'</h2><p>'+esc(t('Завантажуємо ваш дует…','Loading your duet…'))+'</p>';}
      else if(data.state==='not_started'||data.state==='invited'){
        h='<div class="duetHero" aria-hidden="true"><span class="duetOrb">1</span><span class="duetOrb">2</span></div><h2>'+esc(t('Відчуйте вайб одне одного','Discover each other’s vibe'))+'</h2><p>'+esc(t('Обери свою відповідь і спробуй вгадати вибір співрозмовника. Три короткі запитання дадуть привід заговорити.','Choose your answer and guess your partner’s choice. Three quick questions will get you talking.'))+'</p><p>'+esc(t('Можна зіграти в різний час — прогрес збережеться.','Play at different times — your progress is saved.'))+'</p>'+footer()+primary('duetBegin',data.state==='invited'?'Прийняти запрошення':'Запропонувати гру',data.state==='invited'?'Accept invitation':'Invite to play');
      }else if(data.state==='playing'){
        const index=data.my_progress,q=data.questions[index],key=matchId+':'+index;
        if(key!==questionKey){questionKey=key;selection={choice:null,guess:null};}
        h='<div class="duetMeta">'+esc(t('Запитання ','Question '))+(index+1)+' / 3</div><div class="duetProgress" aria-hidden="true">'+[0,1,2].map(i=>'<span class="'+(i<index?'done':'')+'"></span>').join('')+'</div><h2 class="duetQuestion">'+esc(text(q.title))+'</h2>';
        for(const [kind,uk,en] of [['choice','Твій вибір','Your choice'],['guess','Що обере співрозмовник?','What will your partner choose?']]){
          h+='<span class="duetLabel" id="duetLabel-'+kind+'">'+esc(t(uk,en))+'</span><div class="duetChoices" role="group" aria-labelledby="duetLabel-'+kind+'">'+q.options.map((option,i)=>'<button type="button" class="duetChoice" data-kind="'+kind+'" data-value="'+i+'" aria-pressed="'+(selection[kind]===i)+'"'+(busy?' disabled':'')+'>'+esc(text(option))+'</button>').join('')+'</div>';
        }
        h+=primary('duetSave',index===2?'Завершити мою частину':'Зберегти й далі',index===2?'Finish my part':'Save and continue')+footer();
      }else if(data.state==='waiting'){
        h='<div class="duetHero" aria-hidden="true"><span class="duetOrb">✓</span><span class="duetOrb">…</span></div><h2>'+esc(t('Твою частину завершено','Your part is complete'))+'</h2><p>'+esc(t('Відповіді збережено. Можеш повернутися до розмови — результат відкриється, коли завершить співрозмовник.','Your answers are saved. Return to your chat — results open when your partner finishes.'))+'</p><div class="duetMeta">'+esc(t('Прогрес співрозмовника: ','Your partner’s progress: '))+data.peer_progress+' / 3</div>'+primary('duetRefresh','Перевірити результат','Check results');
      }else if(data.state==='completed'){
        h='<h2>'+esc(t('Ваш VYBE-дует','Your VYBE duet'))+'</h2><p>'+esc(t('Ось що ви обрали. Тепер є про що поговорити.','Here is what you chose. Now you have something to talk about.'))+'</p><div class="duetScore"><div><strong>'+data.same_answers+'/3</strong><small>'+esc(t('спільних відповідей','shared answers'))+'</small></div><div><strong>'+data.guessed_correct+'/3</strong><small>'+esc(t('ти вгадав/-ла','you guessed'))+'</small></div></div>';
        for(const row of data.results){const q=data.questions[row.question_index];h+='<div class="duetResult"><h3>'+esc(text(q.title))+'</h3><p>'+esc(t('Ти: ','You: '))+esc(text(q.options[row.my_choice]))+'</p><p>'+esc(t('Співрозмовник: ','Your partner: '))+esc(text(q.options[row.peer_choice]))+'</p></div>';}
        const first=data.results.find(row=>row.my_choice!==row.peer_choice)||data.results[0];
        h+=primary('duetPrompt','Продовжити розмову','Continue the conversation')+'<p class="duetHint">'+esc(t('Додамо запитання в поле повідомлення. Надсилання — за тобою.','We will add a question to your message box. You decide when to send it.'))+'</p>';
        panel.dataset.prompt=text(data.questions[first.question_index].follow_up);
      }
      h+='<p id="duetError" class="duetError" role="status" aria-live="polite">'+esc(error)+'</p>';
      if(!data&&error)h+=primary('duetRetry','Спробувати знову','Try again');
      panel.innerHTML=h;
      const bind=(id,fn)=>{const el=d.getElementById(id);if(el)el.onclick=fn;};
      bind('duetBegin',()=>operate(data.state==='invited'?'duet_join':'duet_start'));
      bind('duetSave',()=>operate('duet_answer',{question_index:data.my_progress,choice:selection.choice,guess:selection.guess}));
      bind('duetRefresh',()=>refresh());bind('duetRetry',()=>refresh());
      bind('duetPrompt',()=>{const prompt=panel.dataset.prompt;close();ctx.onPrompt?.(prompt);capture('duet_conversation_prompt_used');});
      panel.querySelectorAll('.duetChoice').forEach(el=>el.onclick=()=>{
        if(busy)return;selection[el.dataset.kind]=Number(el.dataset.value);
        panel.querySelectorAll('[data-kind="'+el.dataset.kind+'"]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.value)===selection[el.dataset.kind])));
        d.getElementById('duetSave').disabled=busy||selection.choice===null||selection.guess===null;
      });
      const save=d.getElementById('duetSave');if(save)save.disabled=busy||selection.choice===null||selection.guess===null;
      if(focused){
        const target=focusId?d.getElementById(focusId):focusKind?panel.querySelector('[data-kind="'+focusKind+'"][data-value="'+focusValue+'"]'):null;
        if(target&&!target.disabled)target.focus({preventScroll:true});
        else{const heading=panel.querySelector('h2');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}
      }
    }
    function failure(result){
      if(result?.error==='CHAT_UNAVAILABLE'||result?.error==='ACCOUNT_RESTRICTED'){
        close();data=null;error=t('Цей дует уже недоступний.','This duet is no longer available.');
        if(button)button.disabled=true;
      }else error=t('Не вдалося завантажити або зберегти дует. Перевір з’єднання й спробуй ще раз.','Could not load or save the duet. Check your connection and try again.');
    }
    async function refresh(){
      if(!available()||busy)return;
      const generation=epoch,id=++serial,key=matchId;
      try{
        const r=await ctx.api('duet_get',{match_id:key});
        if(generation!==epoch||id!==serial||!available())return;
        if(r?.ok){const changed=JSON.stringify(data)!==JSON.stringify(r);data=r;error='';lastRead=Date.now();if(changed||overlay?.querySelector('.duetError')?.textContent)render();else label();}
        else{failure(r);render();}
      }catch{if(generation===epoch&&id===serial){failure();render();}}
    }
    async function operate(action,input={}){
      if(!available()||busy)return;
      busy=true;error='';serial++;render();
      const generation=epoch,key=matchId;let reconcile=false;
      try{
        const r=await ctx.api(action,{match_id:key,...input});
        if(generation!==epoch||!available())return;
        if(r?.ok){data=r;lastRead=Date.now();capture(action==='duet_answer'?(r.my_progress===3?'duet_part_completed':'duet_answer_saved'):action==='duet_join'?'duet_joined':'duet_started');}
        else{failure(r);reconcile=r?.error==='DUET_ANSWER_LOCKED'||r?.error==='INVALID_DUET_ANSWER';}
      }catch{if(generation===epoch)failure();}
      finally{if(generation===epoch){busy=false;render();schedule();if(reconcile)refresh();}}
    }
    function open(){
      if(!available()||overlay)return;
      previousFocus=button||d.activeElement;overlay=d.createElement('div');overlay.className='duetOverlay';overlay.id='duetDialog';
      overlay.innerHTML='<section class="duetPanel" role="dialog" aria-modal="true" aria-label="VYBE-дует"><div class="duetTop"><span class="duetBrand">VYBE DUET</span><button class="duetClose" type="button" aria-label="'+esc(t('Закрити','Close'))+'">×</button></div><div class="duetBody"></div><button class="duetSecondary duetReturn" type="button">'+esc(t('Повернутися до чату','Return to chat'))+'</button></section>';
      background=[...d.body.children].map(node=>[node,node.getAttribute('inert')]);
      for(const [node] of background)node.setAttribute('inert','');
      d.body.append(overlay);overlay.querySelector('.duetClose').onclick=close;overlay.querySelector('.duetReturn').onclick=close;
      overlay.addEventListener('keydown',event=>{
        if(event.key==='Escape'){event.preventDefault();close();return;}
        if(event.key!=='Tab')return;
        const items=[...overlay.querySelectorAll('button:not(:disabled)')],first=items[0],last=items.at(-1);
        if(event.shiftKey&&d.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&d.activeElement===last){event.preventDefault();first?.focus();}
      });
      render();overlay.querySelector('.duetClose').focus();capture('duet_opened');refresh();schedule();
    }
    function mount(){
      const chat=ctx.getChat?.(),header=d.querySelector('#sheetContent .chatHeader');
      if(!chat||!header)return dispose();
      if(matchId!==chat.matchId||!button?.isConnected){
        dispose();matchId=chat.matchId;const bar=d.createElement('div');bar.className='duetBar';
        bar.innerHTML='<button class="duetLaunch" type="button">'+mark+'<span><strong>VYBE-дует</strong><small></small></span><span class="duetArrow" aria-hidden="true">›</span></button>';
        header.after(bar);button=bar.querySelector('button');button.onclick=open;label();refresh();
      }else if(Date.now()-lastRead>60000)refresh();
      schedule();
    }
    const observer=new w.MutationObserver(()=>{if(matchId&&(!available()||d.getElementById('vybeCall')))dispose();});
    observer.observe(d.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    const onVisible=()=>{if(!d.hidden&&available())refresh();};d.addEventListener('visibilitychange',onVisible);
    return {mount,refresh,close,dispose,isOpen:()=>!!overlay,destroy(){dispose();observer.disconnect();d.removeEventListener('visibilitychange',onVisible);}};
  }
  return {create};
});
