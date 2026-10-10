const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const requireFixture=createRequire(path.join(process.argv[2]||'/tmp/vybe-emoji-test','package.json'));
const {JSDOM}=requireFixture('jsdom');
const html=fs.readFileSync('index.html','utf8');
const source=['profile-cities.js','profile-fields.js','interests-map.js','chat-media.js','chat-emoji.js','duet.js','photo-viewer.js','start-guide.js','plans.js','app.js'].map(file=>fs.readFileSync(file,'utf8')).join('\n;\n');
const existing={name:'Test',age:28,city:'Київ',bio:'Люблю каву й гори',user_id:'owner',photo_url:'https://ui-fixture.invalid/photo.jpg',interests:['coffee'],map_enabled:false};
const pause=()=>new Promise(resolve=>setTimeout(resolve,10));
let checks=0;

async function fixture(profile,language='uk',options={}){
  const dom=new JSDOM(html,{url:'https://ui-fixture.invalid/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,requests=[];let current=profile?{...profile}:null,rejectBio=false,rejectPhoto=null;
  if(Object.hasOwn(options,'serverProfile'))current=options.serverProfile?{...options.serverProfile}:null;
  const userId=options.userId||'owner';
  w.console={...console,warn(){},error(){}};
  const noop=()=>{};
  w.Telegram={WebApp:{initData:'fixture-init-data',initDataUnsafe:{user:{id:1,first_name:'Test'}},ready:noop,expand:noop,setHeaderColor:noop,setBackgroundColor:noop,enableClosingConfirmation:noop,viewportHeight:844,BackButton:{show:noop,hide:noop,onClick:noop},HapticFeedback:{notificationOccurred:noop,impactOccurred:noop},showAlert:noop}};
  w.localStorage.setItem('vybe18','yes');w.localStorage.setItem('vybeLanguage',JSON.stringify(language));
  for(const [key,value] of Object.entries(options.storage||{}))w.localStorage.setItem(key,JSON.stringify(value));
  w.fetch=async(url,init={})=>{
    const body=JSON.parse(init.body||'{}');requests.push(body);
    let result={ok:true};
    switch(body.action){
      case 'me':result={ok:true,authenticated:true,user:{id:1,first_name:'Test'}};break;
      case 'profile_get':result={ok:true,user_id:userId,profile:current};break;
      case 'save_profile':
        if(rejectBio){result={ok:false,error:'BIO_REQUIRED',field:'bio'};break;}
        if(rejectPhoto){result={ok:false,error:rejectPhoto,field:'photo'};break;}
        if(!current?.photo_url&&!current?.photo_present&&!body.profile_photo){result={ok:false,error:'PHOTO_REQUIRED',field:'photo'};break;}
        current={...current,...body.profile,photo_present:true,photo_url:body.profile_photo?'https://ui-fixture.invalid/new-photo.webp':current?.photo_url||null};
        result={ok:true,user_id:userId,profile:current,photo_present:true,...(body.profile_photo?{photo_url:current.photo_url}:{})};break;
      case 'set_intent':result={ok:true,intent:body.intent,expires_at:new Date(Date.now()+(Number(body.hours)||1)*3600000).toISOString()};break;
      case 'discover':result={ok:true,people:[],pagination:{has_more:false}};break;
      case 'matches':result={ok:true,matches:[],unread_total:0};break;
      case 'notification_settings_get':result={ok:true,preferences:{likes:true,matches:true,messages:true}};break;
    }
    if(options.respond)result=await options.respond(body,result)||result;
    return {ok:result.ok,status:result.ok?200:400,json:async()=>result,text:async()=>JSON.stringify(result)};
  };
  w.eval(source);
  for(let i=0;i<40;i++){
    if(requests.some(r=>r.action==='support_counts'))break;
    await pause();
  }
  await pause();
  assert.ok(requests.some(r=>r.action==='profile_get'),'fixture must complete real app authentication and hydration');
  return {dom,w,d:w.document,requests,rejectNextBio(){rejectBio=true},rejectNextPhoto(error='PHOTO_UPLOAD_FAILED'){rejectPhoto=error},acceptPhoto(){rejectPhoto=null},saveCalls:()=>requests.filter(r=>r.action==='save_profile')};
}
const input=(f,id,value)=>{const el=f.d.getElementById(id);el.value=value;el.dispatchEvent(new f.w.Event('input',{bubbles:true}));};

module.exports={fixture,input,pause};
if(require.main===module)(async()=>{
  let f=await fixture(null);
  try{
    const field=f.d.getElementById('obBio'),error=f.d.getElementById('obBioError'),form=f.d.getElementById('onboarding');
    assert.equal(field.required,true);assert.equal(field.getAttribute('aria-required'),'true');assert.match(field.getAttribute('aria-describedby'),/obBioHint obBioError/);checks++;
    assert.equal(form.classList.contains('hidden'),false);input(f,'obAge','28');input(f,'obCity','Чернівці');
    for(const bio of ['', ' \n\t ', '\u200b\u200d\ufe0f']){
      input(f,'obBio',bio);await f.d.getElementById('saveProfile').onclick();
      assert.equal(f.saveCalls().length,0);assert.equal(form.classList.contains('hidden'),false);
      assert.equal(field.getAttribute('aria-invalid'),'true');assert.equal(f.d.activeElement,field);
      assert.equal(error.classList.contains('hidden'),false);assert.match(error.textContent,/Заповни/);
      assert.equal(f.d.getElementById('obCity').value,'Чернівці');checks++;
    }
    input(f,'obBio','  Люблю каву й гори ☕  ');
    assert.equal(field.hasAttribute('aria-invalid'),false);assert.equal(field.validationMessage,'');assert.equal(error.classList.contains('hidden'),true);checks++;
    await f.d.getElementById('saveProfile').onclick();
    assert.equal(f.saveCalls().length,0,'new profiles still need a photo after the bio is valid');
    assert.equal(form.classList.contains('hidden'),false);assert.match(f.d.getElementById('obPhotoError').textContent,/Додай фото/);
    assert.equal(f.d.getElementById('saveProfile').disabled,false);checks++;
  }finally{await pause();f.dom.window.close()}

  f=await fixture({...existing,bio:'   '});
  try{
    assert.equal(f.d.getElementById('onboarding').classList.contains('hidden'),false);
    assert.equal(f.saveCalls().length,0,'legacy blank profiles must not be silently saved');
    assert.equal(f.d.getElementById('obName').value,'Test');assert.equal(f.d.getElementById('obAge').value,'28');checks++;
    input(f,'obBio','Опис');f.rejectNextBio();await f.d.getElementById('saveProfile').onclick();
    assert.equal(f.d.getElementById('onboarding').classList.contains('hidden'),false);assert.match(f.d.getElementById('obBioError').textContent,/Заповни/);
    assert.equal(f.d.getElementById('saveProfile').disabled,false);assert.equal(f.d.getElementById('obBio').value,'Опис');checks++;
    f.d.getElementById('editProfile').click();assert.equal(f.d.getElementById('obBioError').classList.contains('hidden'),true);checks++;
  }finally{await pause();f.dom.window.close()}

  f=await fixture(existing);
  try{
    assert.equal(f.d.getElementById('onboarding').classList.contains('hidden'),true);assert.ok(f.saveCalls().length>0);checks++;
    f.d.getElementById('editProfile').click();input(f,'obBio','');const saves=f.saveCalls().length;
    await f.d.getElementById('saveProfile').onclick();assert.equal(f.saveCalls().length,saves);assert.equal(f.d.getElementById('onboarding').classList.contains('hidden'),false);checks++;
  }finally{await pause();f.dom.window.close()}

  f=await fixture({...existing,bio:''},'en');
  try{
    assert.match(f.d.getElementById('obBioHint').textContent,/Required/);
    await f.d.getElementById('saveProfile').onclick();assert.match(f.d.getElementById('obBioError').textContent,/Fill in About me/);checks++;
  }finally{await pause();f.dom.window.close()}
  console.log(`Required profile bio UI checks passed: ${checks}`);
})().catch(error=>{console.error(error);process.exitCode=1});
