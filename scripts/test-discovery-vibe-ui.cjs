const assert=require('node:assert/strict'),fs=require('node:fs');
const {fixture,pause}=require('./test-profile-bio-ui.cjs');
const source=fs.readFileSync('discovery-vibe.js','utf8');
const profile={name:'Test',age:28,city:'Київ',bio:'Люблю каву й гори',user_id:'owner',photo_url:'https://ui-fixture.invalid/photo.jpg',interests:['coffee'],map_enabled:false};
let checks=0;
async function check(name,run){await run();checks++;console.log('PASS:',name)}
const el=(f,id)=>f.d.getElementById(id);
const mood=(f,value)=>[...f.d.querySelectorAll('.mood')].find(b=>b.dataset.mood===value);
async function chooseVibe(f,intent){
  el(f,'setNow').click();
  [...el(f,'sheetContent').querySelectorAll('[data-intent]')].find(b=>b.dataset.intent===intent).click();
  el(f,'saveNow').click();await pause();
}

(async()=>{
  const f=await fixture(profile);
  try{
    f.w.eval(source);await pause();
    await check('an unset vibe keeps the chooser available without enabling a vibe or making API requests',()=>{
      assert.equal(el(f,'vibeControls').open,true);
      assert.equal(f.requests.filter(r=>r.action==='set_intent').length,0);
      assert.equal(f.w.localStorage.getItem('vybeNow'),null);
    });
    await check('submitting without selecting a vibe leaves the chooser available and makes no API request',async()=>{
      el(f,'setNow').click();el(f,'saveNow').click();await pause();
      assert.equal(el(f,'vibeControls').open,true);
      assert.equal(f.requests.filter(r=>r.action==='set_intent').length,0);
      el(f,'closeSheet').click();
    });
    await check('saving a real vibe collapses the chooser and preserves the current search selection',async()=>{
      await chooseVibe(f,'Поговорити');
      assert.equal(el(f,'vibeControls').open,false);
      assert.equal(el(f,'compactVibeLabel').textContent,'💬 Поговорити');
      assert.equal(el(f,'compactSearchLabel').hidden,true);
      assert.equal(mood(f,'Поговорити').classList.contains('active'),true);
      assert.equal(f.requests.filter(r=>r.action==='set_intent').at(-1).intent,'Поговорити');
    });
    await check('the native summary reopens the existing change button and filter options',()=>{
      el(f,'vibeSummary').click();assert.equal(el(f,'vibeControls').open,true);
      assert.equal(el(f,'setNow').textContent,'Змінити');
      assert.equal(f.d.querySelectorAll('.mood').length,6);
    });
    await check('a remaining-time refresh leaves an intentionally reopened chooser open',async()=>{
      f.w.renderNow();await pause();assert.equal(el(f,'vibeControls').open,true);
    });
    await check('renewing the same vibe also collapses the options after selection',async()=>{
      await chooseVibe(f,'Поговорити');
      assert.equal(el(f,'vibeControls').open,false);
      assert.equal(f.requests.filter(r=>r.action==='set_intent').length,2);
      el(f,'vibeSummary').click();
    });
    await check('choosing a search filter collapses options, restores focus and keeps the user’s own vibe',async()=>{
      const stored=f.w.localStorage.getItem('vybeNow');
      mood(f,'Усе').focus();mood(f,'Усе').click();await pause();
      assert.equal(el(f,'vibeControls').open,false);
      assert.equal(f.d.activeElement,el(f,'vibeSummary'));
      assert.equal(f.w.localStorage.getItem('vybeNow'),stored);
      assert.equal(el(f,'compactSearchLabel').textContent,'Пошук: Усе');
      assert.equal(el(f,'compactSearchLabel').hidden,false);
      assert.equal(mood(f,'Усе').classList.contains('active'),true);
      assert.equal(f.requests.filter(r=>r.action==='discover').at(-1).intent,'');
    });
    await check('a changed vibe collapses controls without moving focus out of the active dialog',async()=>{
      el(f,'vibeSummary').click();el(f,'setNow').click();
      const choice=[...el(f,'sheetContent').querySelectorAll('[data-intent]')].find(b=>b.dataset.intent==='Дружба');
      choice.click();el(f,'saveNow').focus();
      const save=el(f,'saveNow');save.click();await pause();
      assert.equal(el(f,'vibeControls').open,false);
      assert.equal(el(f,'compactVibeLabel').textContent,'🫶 Дружба');
      assert.equal(f.d.activeElement,save);
      assert.equal(el(f,'compactSearchLabel').hidden,true);
    });
    await check('language changes translate the compact control without changing vibe or filter values',async()=>{
      el(f,'vibeSummary').click();f.w.setLanguage('en');await pause();
      assert.equal(el(f,'vibeControls').open,true);
      assert.equal(el(f,'compactVibeLabel').textContent,'🫶 Friendship');
      assert.match(el(f,'vibeSummary').getAttribute('aria-label'),/^Vibe and search:/);
      assert.equal(mood(f,'Дружба').classList.contains('active'),true);
      assert.equal(JSON.parse(f.w.localStorage.getItem('vybeNow')).intent,'Дружба');
    });
    await check('an expired vibe reopens the setup affordance and clears the expired saved state',async()=>{
      el(f,'vibeSummary').click();
      const realNow=f.w.Date.now;f.w.Date.now=()=>realNow()+4*3600000;
      try{f.w.renderNow();await pause()}finally{f.w.Date.now=realNow}
      assert.equal(el(f,'vibeControls').open,true);
      assert.equal(el(f,'setNow').textContent,'Set');
      assert.equal(f.w.localStorage.getItem('vybeNow'),null);
    });
  }finally{f.dom.window.close()}

  const saved=await fixture(profile);
  try{
    await chooseVibe(saved,'Флірт');saved.w.eval(source);await pause();
    await check('an already active vibe starts collapsed when the control attaches',()=>{
      assert.equal(el(saved,'vibeControls').open,false);
      assert.equal(el(saved,'compactVibeLabel').textContent,'🔥 Флірт');
      assert.equal(saved.requests.filter(r=>r.action==='set_intent').length,1);
    });
  }finally{saved.dom.window.close()}
  console.log(`Compact discovery vibe UI checks passed: ${checks}`);
})().catch(error=>{console.error(error);process.exitCode=1});
