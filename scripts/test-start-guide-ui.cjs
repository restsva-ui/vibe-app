const assert=require('node:assert/strict');
const {fixture,input,pause}=require('./test-profile-bio-ui.cjs');
const profile={name:'Test',age:28,city:'Київ',bio:'Люблю каву й гори',user_id:'owner',photo_url:'https://ui-fixture.invalid/photo.jpg',interests:[],map_enabled:false};
const el=(f,id)=>f.d.getElementById(id),guide=f=>el(f,'startGuide');
const action=f=>guide(f).querySelector('.startGuideAction');
const progress=f=>JSON.parse(f.w.localStorage.getItem('vybeStartGuide:v1:owner'));
const nav=(f,target)=>[...f.d.querySelectorAll('.navItem')].find(b=>b.dataset.target===target);
const activeVibe=()=>({intent:'Поговорити',icon:'💬',expires:Date.now()+3600000,user_id:'owner'});
const match=(message=false)=>({match_id:'match-1',user_id:'peer',created_at:new Date().toISOString(),last_message:message?'Привіт!':'',last_message_at:message?new Date().toISOString():null,profile:{name:'Partner',age:29}});
let checks=0;
async function check(name,run){await run();checks++;console.log('PASS:',name)}
async function choose(f,intent='Поговорити'){
  el(f,'setNow').click();
  [...el(f,'sheetContent').querySelectorAll('[data-intent]')].find(b=>b.dataset.intent===intent).click();
}

(async()=>{
  let f=await fixture(null);
  try{
    await check('a missing required profile shows onboarding without exposing or recording start milestones',()=>{
      assert.equal(guide(f).hidden,true);assert.equal(el(f,'startGuideBtn').hidden,true);
      assert.equal(progress(f),null);assert.equal(el(f,'onboarding').classList.contains('hidden'),false);
    });
  }finally{f.dom.window.close()}

  f=await fixture(profile);
  try{
    await check('the optional collapsed guide lives in Profile and never occupies a discovery photo',()=>{
      assert.equal(guide(f).parentNode.id,'profileView');assert.equal(guide(f).hidden,false);
      assert.equal(guide(f).querySelector('details').open,false);assert.equal(action(f).textContent,'Обрати інтереси');
      assert.equal(f.requests.some(r=>['like','super_like','message_send','set_intent'].includes(r.action)),false);
    });
    await check('the interests action opens the real editor and focuses choices without saving them',async()=>{
      el(f,'startGuideBtn').click();const saves=f.saveCalls().length;
      action(f).click();await pause();
      assert.equal(el(f,'onboarding').classList.contains('hidden'),false);
      assert.ok(el(f,'obInterests').contains(f.d.activeElement));assert.equal(f.saveCalls().length,saves);
      el(f,'obInterests').querySelector('[data-interest="coffee"]').click();
      assert.equal(progress(f).interests,false,'unsaved choices do not count');
      await el(f,'saveProfile').onclick();await pause();
      assert.equal(progress(f).interests,true);assert.equal(action(f).textContent,'Задати VYBE NOW');
    });
    await check('a pending or failed vibe request keeps progress, search selection and active state unchanged',async()=>{
      let resolve;const original=f.w.fetch;
      f.w.fetch=async(url,init)=>{
        if(JSON.parse(init.body||'{}').action==='set_intent')return new Promise(r=>{resolve=r});
        return original(url,init);
      };
      action(f).click();await pause();
      el(f,'sheetContent').querySelector('[data-intent="Дружба"]').click();
      const button=el(f,'saveNow'),saving=button.onclick();assert.equal(button.disabled,true);
      await button.onclick();assert.equal(progress(f).vibe,false);assert.equal(f.w.localStorage.getItem('vybeNow'),null);
      resolve({ok:false,status:503,text:async()=>JSON.stringify({ok:false,error:'Unavailable'})});await saving;await pause();
      assert.equal(button.disabled,false);assert.equal(el(f,'sheet').classList.contains('hidden'),false);
      assert.equal(el(f,'sheetContent').querySelector('.choice[data-intent].selected').dataset.intent,'Дружба');
      assert.equal(f.d.querySelector('.mood.active').dataset.mood,'Усе');assert.equal(progress(f).vibe,false);
      f.w.fetch=original;
    });
    await check('a successful vibe records a milestone only after the server response and routes empty discovery to filter reset',async()=>{
      await el(f,'saveNow').onclick();await pause();
      const now=JSON.parse(f.w.localStorage.getItem('vybeNow'));
      assert.equal(now.intent,'Дружба');assert.equal(now.user_id,'owner');assert.equal(progress(f).vibe,true);
      assert.equal(action(f).textContent,'Скинути фільтри');
      action(f).click();await pause();assert.equal(el(f,'discoverView').classList.contains('active'),true);
      assert.equal(f.requests.filter(r=>r.action==='discover').at(-1).intent,'');
      assert.equal(action(f).textContent,'Запросити друга');
      assert.equal(f.requests.some(r=>r.action==='like'||r.action==='super_like'),false);
    });
    await check('an expired vibe preserves the milestone but recommends renewing current visibility',async()=>{
      const realNow=f.w.Date.now;f.w.Date.now=()=>realNow()+4*3600000;
      try{f.w.renderNow();await pause();assert.equal(progress(f).vibe,true);assert.equal(action(f).textContent,'Задати VYBE NOW')}
      finally{f.w.Date.now=realNow}
    });
    await check('hiding suggestions retains keyboard focus and the profile menu restores them',async()=>{
      const dismiss=guide(f).querySelector('.startGuideDismiss');dismiss.focus();dismiss.click();await pause();
      assert.equal(guide(f).hidden,true);assert.equal(progress(f).hidden,true);assert.equal(f.d.activeElement,el(f,'startGuideBtn'));
      el(f,'startGuideBtn').click();await pause();assert.equal(guide(f).hidden,false);assert.equal(progress(f).hidden,false);
      assert.equal(guide(f).querySelector('details').open,true);
    });
    await check('a language change updates the guide without altering milestones or opening a sheet',async()=>{
      const before=JSON.stringify(progress(f));f.w.setLanguage('en');await pause();
      assert.equal(guide(f).querySelector('.startGuideHeading').textContent,'Start in VYBE');
      assert.equal(guide(f).querySelector('.startGuideCount').textContent,'2 of 3');assert.equal(action(f).textContent,'Set VYBE NOW');
      assert.equal(JSON.stringify(progress(f)),before);assert.equal(el(f,'sheet').classList.contains('hidden'),true);
    });
    await check('stored milestones contain booleans only and account deletion cleanup removes them',()=>{
      assert.deepEqual(Object.keys(progress(f)).sort(),['conversation','hidden','interests','vibe']);
      assert.ok(Object.values(progress(f)).every(v=>typeof v==='boolean'));
      f.w.resetLocalVYBE();assert.equal(progress(f),null);
    });
  }finally{f.dom.window.close()}

  let rows=[match(false)];
  f=await fixture({...profile,interests:['coffee']},'uk',{storage:{vybeProfile:profile,vybeNow:activeVibe()},respond:(body,result)=>body.action==='matches'?{ok:true,matches:rows}:result});
  try{
    await check('an existing mutual match routes to real chats without sending a message or invitation',async()=>{
      el(f,'startGuideBtn').click();assert.equal(action(f).textContent,'Відкрити чати');action(f).click();await pause();
      assert.equal(el(f,'chatView').classList.contains('active'),true);assert.equal(f.d.querySelectorAll('.chatOpen').length,1);
      assert.equal(f.requests.some(r=>['message_send','duet_start'].includes(r.action)),false);
      assert.equal(progress(f).conversation,false);
    });
    await check('a server-confirmed conversation completes the guide, which remains available from Profile',async()=>{
      rows=[match(true)];await f.w.loadMatches();await pause();
      assert.equal(progress(f).conversation,true);
      // This session explicitly opened the guide, so completion remains readable.
      assert.equal(guide(f).querySelector('.startGuideCount').textContent,'3 з 3');
      assert.match(guide(f).querySelector('.startGuideNext p').textContent,/VYBE-дует/);
      el(f,'startGuideBtn').click();assert.equal(el(f,'profileView').classList.contains('active'),true);
    });
  }finally{f.dom.window.close()}

  f=await fixture({...profile,interests:['coffee']},'uk',{storage:{'vybeStartGuide:v1:owner':{interests:true,vibe:true,conversation:true,hidden:false}}});
  try{
    await check('a completed guide stays out of the way on the next launch and can be reopened',()=>{
      assert.equal(guide(f).hidden,true);el(f,'startGuideBtn').click();assert.equal(guide(f).hidden,false);
      assert.equal(guide(f).querySelector('.startGuideCount').textContent,'3 з 3');
    });
  }finally{f.dom.window.close()}

  f=await fixture(profile,'uk',{storage:{'vybeStartGuide:v1:owner':{interests:true,vibe:true,conversation:false,hidden:true}}});
  try{
    await check('dismissal survives reopening the app without removing the restore control',()=>{
      assert.equal(guide(f).hidden,true);assert.equal(el(f,'startGuideBtn').hidden,false);
      el(f,'startGuideBtn').click();assert.equal(guide(f).hidden,false);assert.equal(progress(f).hidden,false);
    });
  }finally{f.dom.window.close()}

  f=await fixture(null,'uk',{userId:'other',storage:{vybeProfile:profile,vybeNow:activeVibe(),'vybeStartGuide:v1:owner':{interests:true,vibe:true,conversation:true,hidden:true}}});
  try{
    await check('another account cannot inherit or silently save a cached profile, vibe or progress',()=>{
      assert.equal(f.saveCalls().length,0);assert.equal(el(f,'onboarding').classList.contains('hidden'),false);
      assert.equal(f.w.localStorage.getItem('vybeNow'),null);assert.equal(f.w.localStorage.getItem('vybeProfile'),null);
      assert.equal(f.w.localStorage.getItem('vybeStartGuide:v1:other'),null);assert.equal(guide(f).hidden,true);
    });
  }finally{f.dom.window.close()}

  let fail=true;
  f=await fixture({...profile,interests:['coffee']},'uk',{respond:(body,result)=>body.action==='discover'&&fail?{ok:false,error:'Offline'}:result});
  try{
    await check('a discovery failure is an error with retry, rather than an empty-market or referral claim',async()=>{
      assert.match(el(f,'cardStack').textContent,/Не вдалося оновити пошук/);assert.equal(el(f,'emptyInvite'),null);
      fail=false;el(f,'emptySecondary').click();await pause();assert.match(el(f,'cardStack').textContent,/Зараз немає активних анкет/);
      assert.ok(el(f,'emptyInvite'));assert.equal(el(f,'emptySecondary').disabled,false);
    });
    await check('an empty discovery invitation opens the referral screen without sharing anything automatically',async()=>{
      const opened=[];f.w.Telegram.WebApp.openTelegramLink=url=>opened.push(url);
      el(f,'emptyInvite').click();await pause();assert.ok(el(f,'shareReferral'));
      assert.equal(f.requests.filter(r=>r.action==='referral_stats').length,1);assert.deepEqual(opened,[]);
    });
    await check('empty matches and chats link back to actual discovery',()=>{
      for(const target of ['matchesView','chatView']){
        nav(f,target).click();el(f,target).querySelector('.emptyStateAction').click();
        assert.equal(el(f,'discoverView').classList.contains('active'),true);
      }
    });
  }finally{f.dom.window.close()}

  f=await fixture({...profile,interests:['coffee']},'uk',{storage:{vybeProfile:profile,vybeNow:activeVibe()}});
  try{
    await check('a failed change preserves an already active vibe and its search selection',async()=>{
      const original=f.w.fetch,before=f.w.localStorage.getItem('vybeNow');
      f.w.fetch=async(url,init)=>JSON.parse(init.body||'{}').action==='set_intent'
        ?{ok:false,status:503,text:async()=>JSON.stringify({ok:false,error:'Offline'})}:original(url,init);
      await choose(f,'Флірт');await el(f,'saveNow').onclick();await pause();
      assert.equal(f.w.localStorage.getItem('vybeNow'),before);
      assert.equal(f.d.querySelector('.mood.active').dataset.mood,'Поговорити');
      assert.equal(el(f,'nowLabel').textContent,'💬 Поговорити');
      assert.equal(el(f,'sheet').classList.contains('hidden'),false);
    });
    await check('a late successful activation cannot close a replacement Settings sheet',async()=>{
      let resolve;f.w.fetch=async()=>new Promise(r=>{resolve=r});
      const button=el(f,'saveNow'),saving=button.onclick();
      f.w.openSettings();assert.ok(el(f,'langUkBtn'));
      resolve({ok:true,status:200,text:async()=>JSON.stringify({ok:true,expires_at:new Date(Date.now()+3600000).toISOString()})});
      // The next discover request is also delayed, so finish it explicitly.
      for(let i=0;i<20&&!JSON.parse(f.w.localStorage.getItem('vybeNow')).intent.includes('Флірт');i++)await pause();
      await pause();resolve({ok:true,status:200,text:async()=>JSON.stringify({ok:true,people:[],pagination:{has_more:false}})});
      await saving;await pause();assert.ok(el(f,'langUkBtn'));assert.equal(el(f,'sheet').classList.contains('hidden'),false);
    });
  }finally{f.dom.window.close()}

  f=await fixture(profile,'uk',{userId:'other',storage:{vybeProfile:profile,vybeNow:activeVibe(),'vybeStartGuide:v1:owner':{interests:true,vibe:true,conversation:true,hidden:true}}});
  try{
    await check('a different complete account gets its own visible guide and fresh milestones',()=>{
      assert.equal(guide(f).hidden,false);assert.equal(guide(f).querySelector('.startGuideCount').textContent,'0 з 3');
      assert.equal(f.w.localStorage.getItem('vybeNow'),null);
      assert.equal(f.d.querySelector('.mood.active').dataset.mood,'Усе');
      assert.equal(f.w.localStorage.getItem('vybeStartGuide:v1:other'),null);
    });
  }finally{f.dom.window.close()}

  f=await fixture(profile,'uk',{respond:(body,result)=>body.action==='profile_get'?{...result,account_status:'restricted'}:result});
  try{
    await check('restricted accounts do not see or record social onboarding suggestions',()=>{
      assert.equal(guide(f).hidden,true);assert.equal(el(f,'startGuideBtn').hidden,true);assert.equal(progress(f),null);
    });
  }finally{f.dom.window.close()}

  f=await fixture(profile,'uk',{respond:(body,result)=>body.action==='profile_get'?{ok:false,error:'Offline'}:result,storage:{vybeProfile:profile}});
  try{
    await check('failed profile hydration never silently syncs cached profile data or enables a guide',()=>{
      assert.equal(f.saveCalls().length,0);assert.equal(guide(f).hidden,true);assert.equal(progress(f),null);
    });
  }finally{f.dom.window.close()}
  console.log(`Start guide and activation UI checks passed: ${checks}`);
})().catch(error=>{console.error(error);process.exitCode=1});
