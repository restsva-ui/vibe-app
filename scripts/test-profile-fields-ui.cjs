const assert=require('node:assert/strict');
const {fixture,input,pause}=require('./test-profile-bio-ui.cjs');
const existing={name:'Test',age:28,city:'Київ',gender:'Чоловік',looking_for:'Жінок',bio:'Люблю каву й гори',photo_url:'https://ui-fixture.invalid/photo.jpg',photo_present:true,interests:['coffee'],map_enabled:false};
let checks=0;
async function check(name,run){await run();checks++;console.log('PASS:',name)}
async function close(f){if(el(f,'obCityDialog')&&!el(f,'obCityDialog').hidden)el(f,'obCityClose').click();await pause();f.dom.window.close()}
const el=(f,id)=>f.d.getElementById(id);
const select=(f,id,value)=>{input(f,id,value);el(f,id).dispatchEvent(new f.w.Event('change',{bubbles:true}))};
const cityButtons=f=>[...el(f,'obCityResults').querySelectorAll('button')];

(async()=>{
  let f=await fixture(null);
  try{
    await check('new profiles use selects without a silently preselected age or city',()=>{
      for(const id of ['obAge','obCity','obGender','obLooking'])assert.equal(el(f,id).tagName,'SELECT');
      assert.equal(el(f,'obAge').value,'');assert.equal(el(f,'obCity').value,'');
      assert.equal(el(f,'obName').tagName,'INPUT');assert.equal(el(f,'obBio').tagName,'TEXTAREA');
      assert.equal(el(f,'obAge').required,true);assert.equal(el(f,'obAge').options.length,83);
      assert.equal(el(f,'obAge').options[1].value,'18');assert.equal(el(f,'obAge').options[82].value,'99');
    });
    await check('the city catalog includes small cities, renamed cities and both special-status cities',()=>{
      assert.equal(f.w.VybeProfileCities.rows.length,463);
      const values=[...el(f,'obCity').options].map(o=>o.value);
      for(const city of ['Київ','Севастополь','Чернівці','Самар','Шептицький','Звягель','Берестечко'])assert.ok(values.includes(city),city);
      assert.equal(new Set(values).size,values.length);assert.ok(values.every(v=>v.length<=40));
    });
    await check('age outside the supported adult range cannot be selected or submitted',async()=>{
      select(f,'obAge','17');assert.equal(el(f,'obAge').value,'');
      input(f,'obBio','Достатній опис');await el(f,'saveProfile').onclick();assert.equal(f.saveCalls().length,0);
    });
  }finally{await close(f)}

  f=await fixture(existing);
  try{
    el(f,'editProfile').click();
    await check('editing hydrates all existing choices and uses the edit title',()=>{
      assert.equal(el(f,'obAge').value,'28');assert.equal(el(f,'obCity').value,'Київ');
      assert.equal(el(f,'obGender').value,'Чоловік');assert.equal(el(f,'obLooking').value,'Жінок');
      assert.equal(el(f,'onboardingTitle').textContent,'Редагувати профіль');
    });
    await check('opening city selection isolates the form and puts focus in the search',()=>{
      el(f,'obCityBtn').focus();el(f,'obCityBtn').click();assert.equal(el(f,'obCityDialog').hidden,false);
      assert.equal(el(f,'onboarding').inert,true);assert.equal(f.d.activeElement,el(f,'obCitySearch'));
      assert.equal(f.d.body.classList.contains('profileCityViewing'),true);
    });
    await check('searching is case-insensitive, includes regions and distinguishes duplicate city names',()=>{
      input(f,'obCitySearch','  ГОРОДОК  ');assert.equal(cityButtons(f).length,2);
      const values=cityButtons(f).map(b=>b.dataset.value);assert.equal(new Set(values).size,2);
      assert.ok(values.some(v=>v.includes('Львівська')));assert.ok(values.some(v=>v.includes('Хмельницька')));
      input(f,'obCitySearch','Городок Львівська');assert.equal(cityButtons(f).length,1);
      assert.equal(el(f,'obCity').value,'Київ','query text must not change the selected city');
    });
    await check('canceling city search keeps the previous city and restores focus and the form',()=>{
      el(f,'obCityClose').click();assert.equal(el(f,'obCity').value,'Київ');assert.equal(el(f,'obCityDialog').hidden,true);
      assert.equal(el(f,'onboarding').inert,false);assert.equal(f.d.activeElement,el(f,'obCityBtn'));
      assert.equal(f.d.body.classList.contains('profileCityViewing'),false);
    });
    await check('an unknown query cannot create or save an arbitrary city',()=>{
      el(f,'obCityBtn').click();input(f,'obCitySearch','Невідоме місто <script>');
      assert.equal(cityButtons(f).length,0);assert.match(el(f,'obCityStatus').textContent,/не знайдено/);
      el(f,'obCitySearch').dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
      assert.equal(el(f,'obCity').value,'Київ');assert.equal(el(f,'obCityDialog').hidden,false);
    });
    await check('English aliases can find a Ukrainian city and Enter selects the single result',()=>{
      input(f,'obCitySearch','Lviv');assert.equal(cityButtons(f).length,1);
      el(f,'obCitySearch').dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
      assert.equal(el(f,'obCity').value,'Львів');assert.equal(el(f,'obCityValue').textContent,'Львів');assert.equal(el(f,'obCityDialog').hidden,true);
    });
    await check('changed list choices are sent to save_profile and reopen with the same values',async()=>{
      select(f,'obAge','41');select(f,'obGender','Жінка');select(f,'obLooking','Усіх');await el(f,'saveProfile').onclick();
      const saved=f.saveCalls().at(-1).profile;assert.equal(saved.age,41);assert.equal(saved.city,'Львів');assert.equal(saved.gender,'Жінка');assert.equal(saved.looking,'Усіх');
      assert.equal(saved.bio,existing.bio);assert.equal(saved.photo_url,existing.photo_url);
      el(f,'editProfile').click();assert.equal(el(f,'obAge').value,'41');assert.equal(el(f,'obCity').value,'Львів');assert.equal(el(f,'obGender').value,'Жінка');assert.equal(el(f,'obLooking').value,'Усіх');
    });
    await check('keyboard navigation and Escape stay within city selection without changing the saved choice',()=>{
      el(f,'obCityBtn').focus();el(f,'obCityBtn').click();input(f,'obCitySearch','Городок');
      el(f,'obCitySearch').dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));assert.equal(f.d.activeElement,cityButtons(f)[0]);
      f.d.activeElement.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));assert.equal(f.d.activeElement,cityButtons(f)[1]);
      f.d.activeElement.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));assert.equal(f.d.activeElement,el(f,'obCityClose'));
      f.d.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(el(f,'obCityDialog').hidden,true);assert.equal(el(f,'obCity').value,'Львів');
    });
    await check('an incoming call releases city selection and its inert states',async()=>{
      el(f,'obCityBtn').click();const call=f.d.createElement('div');call.id='vybeCall';f.d.body.append(call);await pause();
      assert.equal(el(f,'obCityDialog').hidden,true);assert.equal(el(f,'onboarding').inert,false);assert.notEqual(call.inert,true);call.remove();
    });
  }finally{await close(f)}

  const legacy={...existing,city:'Варшава',gender:'Моя відповідь',looking_for:'Жінок 25–40'};
  f=await fixture(legacy,'en');
  try{
    el(f,'editProfile').click();
    await check('old manually entered values remain available without exposing new text entry',()=>{
      for(const [id,value] of [['obCity','Варшава'],['obGender','Моя відповідь'],['obLooking','Жінок 25–40']]){assert.equal(el(f,id).value,value);assert.equal(el(f,id).querySelector('option[data-legacy]').textContent,value)}
      assert.equal(el(f,'obCityValue').textContent,'Варшава');
    });
    await check('English labels translate while legacy values and canonical saved values remain intact',()=>{
      assert.equal(el(f,'obGender').options[1].textContent,'Man');assert.equal(el(f,'obGender').options[1].value,'Чоловік');
      assert.equal(el(f,'obLooking').options[1].textContent,'Women');assert.equal(el(f,'obLooking').options[1].value,'Жінок');
      el(f,'obCityBtn').click();assert.equal(el(f,'obCityTitle').textContent,'Choose a city');
      input(f,'obCitySearch','Варшава');assert.equal(cityButtons(f).length,1);assert.match(cityButtons(f)[0].textContent,/Saved in your profile/);el(f,'obCityClose').click();
    });
    await check('saving another edit leaves legacy demographic values unchanged',async()=>{
      input(f,'obBio','Оновлений опис');await el(f,'saveProfile').onclick();const saved=f.saveCalls().at(-1).profile;
      assert.equal(saved.city,legacy.city);assert.equal(saved.gender,legacy.gender);assert.equal(saved.looking,legacy.looking_for);assert.equal(saved.age,28);
    });
    await check('switching away from a legacy value keeps that value available until the next edit',()=>{
      el(f,'editProfile').click();select(f,'obGender','Чоловік');assert.equal(el(f,'obGender').value,'Чоловік');assert.ok([...el(f,'obGender').options].some(o=>o.value===legacy.gender));
    });
  }finally{await close(f)}

  f=await fixture({...existing,city:'<img src=x onerror=alert(1)>',gender:'<b>custom</b>'});
  try{
    el(f,'editProfile').click();el(f,'obCityBtn').click();
    await check('legacy names are rendered as text without creating HTML',()=>{
      input(f,'obCitySearch','<img');assert.equal(cityButtons(f).length,1);assert.equal(el(f,'obCityDialog').querySelector('img'),null);
      assert.equal(el(f,'obGender').querySelector('b'),null);assert.equal(cityButtons(f)[0].querySelector('span').textContent,'<img src=x onerror=alert(1)>');
    });
  }finally{await close(f)}
  console.log(`Profile list UI checks passed: ${checks}`);
})().catch(error=>{console.error(error);process.exitCode=1});
