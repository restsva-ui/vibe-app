const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const {JSDOM}=createRequire(path.join(process.argv[2]||'/tmp/vybe-emoji-test','package.json'))('jsdom');
const moduleSource=fs.readFileSync('duet.js','utf8');
const questions=[0,1,2].map(i=>({title:{uk:'Запитання '+i,en:'Question '+i},options:[{uk:'Затишок',en:'Cosy'},{uk:'Пригода',en:'Adventure'}],follow_up:{uk:'Куди хочеш поїхати?',en:'Where would you like to go?'}}));
const payload=(state,progress=0,peer=0)=>({ok:true,state,my_progress:progress,peer_progress:peer,my_joined:state!=='invited',questions,my_answers:[],results:[],same_answers:0,guessed_correct:0});
const delay=()=>new Promise(resolve=>setTimeout(resolve,0));
const flush=async()=>{for(let i=0;i<4;i++)await delay();};
let checks=0;
async function fixture(language='uk'){
  const dom=new JSDOM('<div id="sheet"><div id="sheetContent"><div class="chatHeader"></div><textarea id="chatMessage">Чернетка</textarea></div></div>',{url:'https://duet-fixture.invalid',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,d=w.document;let active={matchId:'match-a'},state=payload('not_started'),pending=null,nextOperation=null;
  const requests=[],events=[],prompts=[];
  w.eval(moduleSource);
  const controller=w.VybeDuet.create({document:d,getChat:()=>active,getLang:()=>language,isChatVisible:()=>!d.getElementById('sheet').classList.contains('hidden'),capture:(event,props)=>events.push({event,props}),onPrompt:value=>prompts.push(value),api:async(action,body)=>{
    requests.push({action,...body});if(action==='duet_get'&&pending){const result=await pending;pending=null;return result;}
    if(action!=='duet_get'&&nextOperation){const result=await nextOperation;nextOperation=null;if(result.ok)state=result;return result;}
    return state;
  }});
  controller.mount();await flush();
  return {dom,w,d,controller,requests,events,prompts,set:next=>{state=next;},operate:next=>{nextOperation=next;},pending:next=>{pending=next;},switchChat:next=>{active={matchId:next};},close:()=>{controller.destroy();dom.window.close();}};
}
const select=(f,kind,value)=>f.d.querySelector('[data-kind="'+kind+'"][data-value="'+value+'"]').click();
(async()=>{
  const f=await fixture();
  try{
    assert.equal(f.requests.filter(x=>x.action==='duet_start').length,0);assert.equal(f.d.querySelectorAll('.duetBar').length,1);checks++;
    f.controller.mount();assert.equal(f.d.querySelectorAll('.duetBar').length,1);checks++;
    f.d.querySelector('.duetLaunch').click();await flush();assert.equal(f.d.querySelector('[role=dialog]').getAttribute('aria-modal'),'true');assert.equal(f.d.activeElement.className,'duetClose');assert.equal(f.d.getElementById('sheet').hasAttribute('inert'),true);checks++;
    f.operate(payload('playing'));f.d.getElementById('duetBegin').click();await flush();assert.equal(f.d.getElementById('duetSave').disabled,true);select(f,'choice',1);assert.equal(f.d.getElementById('duetSave').disabled,true);select(f,'guess',0);assert.equal(f.d.getElementById('duetSave').disabled,false);checks++;
    f.operate({ok:false,error:'DUET_UNAVAILABLE'});f.d.getElementById('duetSave').click();await flush();assert.ok(f.d.getElementById('duetError').textContent);assert.equal(f.d.querySelector('[data-kind=choice][data-value="1"]').getAttribute('aria-pressed'),'true');assert.equal(f.d.getElementById('duetSave').disabled,false);checks++;
    let resolveAnswer;f.operate(new Promise(resolve=>{resolveAnswer=resolve;}));f.d.getElementById('duetSave').click();assert.equal(f.d.getElementById('duetSave').disabled,true);assert.equal(f.d.querySelector('.duetChoice').disabled,true);f.d.getElementById('duetSave').click();assert.equal(f.requests.filter(x=>x.action==='duet_answer').length,2);checks++;
    resolveAnswer(payload('playing',1));await flush();assert.equal(f.d.querySelector('.duetQuestion').textContent,'Запитання 1');assert.equal(f.d.getElementById('duetSave').disabled,true);checks++;
    select(f,'choice',0);select(f,'guess',1);const focused=f.d.querySelector('[data-kind=guess][data-value="1"]');focused.focus();f.set(payload('playing',1,1));await f.controller.refresh();assert.equal(f.d.querySelector('[data-kind=guess][data-value="1"]').getAttribute('aria-pressed'),'true');assert.equal(f.d.activeElement.dataset.kind,'guess');checks++;
    const before=f.d.getElementById('chatMessage').value;f.set(payload('waiting',3,1));await f.controller.refresh();assert.match(f.d.querySelector('.duetBody').textContent,/Прогрес співрозмовника: 1/);assert.equal(f.d.getElementById('chatMessage').value,before);assert.equal(f.d.querySelectorAll('.duetResult').length,0);checks++;
    assert.equal(f.controller.close(),true);assert.equal(f.controller.isOpen(),false);assert.equal(f.d.activeElement,f.d.querySelector('.duetLaunch'));assert.equal(f.d.getElementById('chatMessage').value,'Чернетка');assert.equal(f.d.getElementById('sheet').hasAttribute('inert'),false);checks++;
    const completed={...payload('completed',3,3),same_answers:2,guessed_correct:1,results:[0,1,2].map(i=>({question_index:i,my_choice:0,my_guess:0,peer_choice:i===1?1:0,peer_guess:0}))};
    completed.questions=questions.map((q,i)=>i===0?{...q,title:{uk:'<img src=x onerror=alert(1)>',en:'Question'}}:q);f.set(completed);await f.controller.refresh();f.d.querySelector('.duetLaunch').click();await flush();assert.equal(f.d.querySelectorAll('.duetResult').length,3);assert.equal(f.d.querySelector('.duetResult img'),null);checks++;
    f.d.getElementById('duetPrompt').click();assert.equal(f.controller.isOpen(),false);assert.equal(f.prompts.length,1);assert.equal(f.requests.some(x=>x.action==='message_send'),false);assert.ok(f.events.every(x=>!('choice' in x.props)&&!('guess' in x.props)));checks++;
    f.set(payload('playing',1));await f.controller.refresh();let resolveOld;f.pending(new Promise(resolve=>{resolveOld=resolve;}));const oldRead=f.controller.refresh();
    f.d.querySelector('.duetLaunch').click();select(f,'choice',0);select(f,'guess',1);f.operate(payload('playing',2));f.d.getElementById('duetSave').click();await flush();resolveOld(payload('playing',0));await oldRead;assert.equal(f.d.querySelector('.duetQuestion').textContent,'Запитання 2');checks++;
    f.switchChat('match-b');f.controller.mount();await flush();assert.equal(f.controller.isOpen(),false);assert.equal(f.d.querySelectorAll('.duetBar').length,1);checks++;
    const recording=f.d.createElement('div');recording.className='chatMediaDraft';f.d.getElementById('sheetContent').append(recording);await flush();assert.equal(f.d.querySelector('.duetLaunch').disabled,true);recording.remove();await flush();assert.equal(f.d.querySelector('.duetLaunch').disabled,false);
    f.d.querySelector('.duetLaunch').click();await flush();const call=f.d.createElement('div');call.id='vybeCall';f.d.body.append(call);await flush();assert.equal(f.controller.isOpen(),false);assert.equal(f.d.getElementById('sheet').hasAttribute('inert'),false);assert.equal(f.d.querySelector('.duetLaunch').disabled,true);call.remove();await flush();assert.equal(f.d.querySelector('.duetLaunch').disabled,false);checks++;
    f.d.querySelector('.duetLaunch').click();await flush();f.d.getElementById('sheet').classList.add('hidden');await flush();assert.equal(f.controller.isOpen(),false);assert.equal(f.d.querySelector('.duetBar'),null);checks++;
  }finally{f.close();}
  const en=await fixture('en');try{en.set(payload('invited'));await en.controller.refresh();en.d.querySelector('.duetLaunch').click();await flush();assert.equal(en.d.getElementById('duetBegin').textContent,'Accept invitation');en.operate(payload('playing'));en.d.getElementById('duetBegin').click();await flush();assert.equal(en.requests.at(-1).action,'duet_join');assert.equal(en.d.querySelector('.duetQuestion').textContent,'Question 0');en.d.querySelector('.duetReturn').focus();en.d.querySelector('.duetReturn').dispatchEvent(new en.w.KeyboardEvent('keydown',{key:'Tab',bubbles:true}));assert.equal(en.d.activeElement.className,'duetClose');en.d.activeElement.dispatchEvent(new en.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(en.controller.isOpen(),false);checks++;}finally{en.close();}
  // Use the real app fixture to check mounting, chat refresh and Telegram Back.
  const {fixture:appFixture}=require('./test-profile-bio-ui.cjs');const app=await appFixture({name:'QA',age:28,city:'Київ',bio:'Люблю каву',user_id:'owner',photo_url:'https://ui-fixture.invalid/photo.jpg'});
  try{
    const prior=app.w.fetch;app.w.fetch=async(url,init)=>{const body=JSON.parse(init.body||'{}');if(body.action==='messages_list')return Response.json({ok:true,messages:[]});if(body.action==='profile_public')return Response.json({ok:true,profile:{name:'Peer'}});if(body.action==='duet_get')return Response.json(payload('not_started'));return prior(url,init);};
    await app.w.eval('openChat("match-app","Peer","peer")');await flush();assert.equal(app.d.querySelectorAll('.duetBar').length,1);app.d.getElementById('chatMessage').value='Збережи мене';app.d.querySelector('.duetLaunch').click();await flush();app.w.eval('closeSheetView()');assert.equal(app.d.getElementById('duetDialog'),null);assert.equal(app.d.getElementById('sheet').classList.contains('hidden'),false);assert.equal(app.d.getElementById('chatMessage').value,'Збережи мене');checks++;
    await app.w.eval('openChat("match-app","Peer","peer",{silent:true,preserveDraft:true,noMatchRefresh:true})');await flush();assert.equal(app.d.querySelectorAll('.duetBar').length,1);assert.equal(app.d.getElementById('chatMessage').value,'Збережи мене');app.w.eval('closeSheetView()');await flush();assert.equal(app.d.querySelector('.duetBar'),null);checks++;
  }finally{app.dom.window.close();}
  console.log(`Duet UI: ${checks} async, privacy, draft, focus, language and real-chat checks passed.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
