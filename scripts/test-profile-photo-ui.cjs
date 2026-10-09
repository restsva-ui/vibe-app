const assert=require('node:assert/strict');
const {fixture,input,pause}=require('./test-profile-bio-ui.cjs');
const existing={name:'Test',age:28,city:'Київ',bio:'Люблю каву й гори',photo_url:'https://ui-fixture.invalid/old-photo.jpg',photo_present:true,interests:['coffee'],map_enabled:false};
let checks=0;
async function check(name,run){await run();checks++;console.log('PASS:',name)}
function encoder(f){
  const state={hold:false,pending:[],draws:[]};
  f.w.Image=class{
    constructor(){this.naturalWidth=1200;this.naturalHeight=800}
    set src(value){const loaded=()=>this.onload();if(state.hold)state.pending.push(loaded);else f.w.setTimeout(loaded,0)}
  };
  f.w.HTMLCanvasElement.prototype.getContext=()=>({drawImage:(...args)=>state.draws.push(args.slice(1))});
  f.w.HTMLCanvasElement.prototype.toDataURL=()=> 'data:image/webp;base64,dGVzdC1ub3JtYWxpemVkLWltYWdl';
  return state;
}
const pick=(f,file=new f.w.File(['fixture image source'],'photo.png',{type:'image/png'}))=>{
  Object.defineProperty(f.d.getElementById('obPhotoInput'),'files',{configurable:true,value:[file]});
  return f.d.getElementById('obPhotoInput').onchange();
};
const visible=f=>!f.d.getElementById('onboarding').classList.contains('hidden');
async function close(f){await pause();f.dom.window.close()}

(async()=>{
  let f=await fixture(null),e=encoder(f);
  try{
    await check('new registration contains the mandatory photo picker',async()=>{
      assert.equal(visible(f),true);assert.match(f.d.getElementById('obPhotoHint').textContent,/Обов’язково/);
      assert.equal(f.d.getElementById('obPhotoInput').accept,'image/jpeg,image/png,image/webp');assert.equal(f.d.getElementById('removePhotoBtn'),null);
    });
    input(f,'obAge','28');input(f,'obCity','Чернівці');input(f,'obBio','Мій опис');
    await check('valid text without a photo cannot reach save_profile',async()=>{
      await f.d.getElementById('saveProfile').onclick();assert.equal(f.saveCalls().length,0);assert.equal(visible(f),true);
      assert.match(f.d.getElementById('obPhotoError').textContent,/Додай фото/);assert.equal(f.d.activeElement,f.d.getElementById('obPhotoBtn'));
      assert.equal(f.d.getElementById('obBio').value,'Мій опис');assert.equal(f.d.getElementById('obCity').value,'Чернівці');
    });
    await check('canceling the picker retains the form and does not upload',async()=>{
      Object.defineProperty(f.d.getElementById('obPhotoInput'),'files',{configurable:true,value:[]});await f.d.getElementById('obPhotoInput').onchange();
      assert.equal(f.requests.some(x=>x.action==='photo_upload'),false);assert.equal(f.d.getElementById('obPhotoBtn').disabled,false);
    });
    await check('non-image and oversized files leave an actionable error',async()=>{
      for(const file of [new f.w.File(['text'],'photo.txt',{type:'text/plain'}),{type:'image/png',size:12*1024*1024+1}]){
        await pick(f,file);assert.equal(visible(f),true);assert.match(f.d.getElementById('obPhotoError').textContent,/12 МБ/);
        assert.equal(f.d.getElementById('saveProfile').disabled,false);assert.equal(f.d.getElementById('obPhotoBtn').disabled,false);
      }
    });
    await check('selected photo is normalized and previewed before any API request',async()=>{
      await pick(f);assert.equal(f.d.getElementById('obPhotoPreview').classList.contains('hidden'),false);
      assert.match(f.d.getElementById('obPhotoPreview').src,/^data:image\/webp;base64,/);
      assert.deepEqual(e.draws[0],[200,0,800,800,0,0,900,900]);assert.equal(f.d.getElementById('obPhotoError').classList.contains('hidden'),true);
      assert.equal(f.requests.some(x=>x.action==='photo_upload'),false);assert.equal(f.saveCalls().length,0);
    });
    await check('server photo error preserves selected image and all text for retry',async()=>{
      const src=f.d.getElementById('obPhotoPreview').src;f.rejectNextPhoto();await f.d.getElementById('saveProfile').onclick();
      assert.equal(visible(f),true);assert.equal(f.d.getElementById('obPhotoPreview').src,src);assert.equal(f.d.getElementById('obBio').value,'Мій опис');
      assert.match(f.d.getElementById('obPhotoError').textContent,/Спробуй ще раз/);assert.equal(f.d.activeElement,f.d.getElementById('obPhotoBtn'));
      assert.equal(f.d.getElementById('obPhotoBtn').disabled,false);assert.equal(f.d.getElementById('saveProfile').disabled,false);
    });
    await check('retry creates the profile with its photo in one request',async()=>{
      f.acceptPhoto();await f.d.getElementById('saveProfile').onclick();const sent=f.saveCalls().at(-1);
      assert.equal(sent.profile.bio,'Мій опис');assert.equal(sent.profile_photo.mime_type,'image/webp');assert.ok(sent.profile_photo.image_base64);
      assert.equal(visible(f),false);const stored=JSON.parse(f.w.localStorage.getItem('vybeProfile'));
      assert.equal(f.d.getElementById('profileView').classList.contains('active'),true);
      assert.equal(f.d.getElementById('startGuide').hidden,false);
      assert.equal(f.d.querySelector('.startGuideDetails').open,true);
      assert.equal(f.d.activeElement,f.d.querySelector('.startGuideSummary'));
      assert.equal(stored.photo_url,'https://ui-fixture.invalid/new-photo.webp');assert.equal(stored.photo_present,true);
      assert.equal(JSON.stringify(stored).includes(sent.profile_photo.image_base64),false,'photo bytes must never enter localStorage');
    });
  }finally{await close(f)}

  f=await fixture({...existing,photo_url:null,photo_present:false});e=encoder(f);
  try{
    await check('legacy profile without a photo opens completion and preserves existing fields',async()=>{
      assert.equal(visible(f),true);assert.equal(f.saveCalls().length,0);assert.equal(f.d.getElementById('obBio').value,existing.bio);assert.equal(f.d.getElementById('obName').value,existing.name);
      await pick(f);await f.d.getElementById('saveProfile').onclick();assert.equal(visible(f),false);assert.ok(f.saveCalls().at(-1).profile_photo);
    });
  }finally{await close(f)}

  f=await fixture(existing);e=encoder(f);
  try{
    await check('complete profiles continue normally and can edit without re-uploading',async()=>{
      assert.equal(visible(f),false);assert.ok(f.saveCalls().length);f.d.getElementById('editProfile').click();
      assert.equal(f.d.getElementById('discoverView').classList.contains('active'),true,'editing an existing profile must not change views');
      assert.equal(f.d.getElementById('obPhotoPreview').src,existing.photo_url);input(f,'obBio','Оновлений опис');
      await f.d.getElementById('saveProfile').onclick();assert.equal(visible(f),false);assert.equal(Object.hasOwn(f.saveCalls().at(-1),'profile_photo'),false);
    });
    await check('a failed local replacement keeps the previous saved photo',async()=>{
      f.d.getElementById('editProfile').click();await pick(f,new f.w.File(['text'],'file.txt',{type:'text/plain'}));
      assert.equal(f.d.getElementById('obPhotoPreview').src,existing.photo_url);await f.d.getElementById('saveProfile').onclick();assert.equal(visible(f),false);
    });
    await check('saving is blocked while image processing is pending',async()=>{
      f.d.getElementById('editProfile').click();e.hold=true;const processing=pick(f);
      for(let i=0;i<40&&!e.pending.length;i++)await pause();assert.equal(e.pending.length,1);
      assert.equal(f.d.getElementById('saveProfile').disabled,true);assert.equal(f.d.getElementById('obPhotoBtn').disabled,true);
      const count=f.saveCalls().length;await f.d.getElementById('saveProfile').onclick();assert.equal(f.saveCalls().length,count);
      e.pending.shift()();await processing;assert.equal(f.d.getElementById('saveProfile').disabled,false);
    });
    await check('late image decoding cannot overwrite a reopened form',async()=>{
      e.hold=true;const processing=pick(f);for(let i=0;i<40&&!e.pending.length;i++)await pause();
      f.d.getElementById('editProfile').click();e.pending.shift()();await processing;
      assert.equal(f.d.getElementById('obPhotoPreview').src,existing.photo_url);assert.equal(f.d.getElementById('saveProfile').disabled,false);
    });
  }finally{await close(f)}

  f=await fixture({...existing,photo_url:null,photo_present:true});
  try{
    await check('temporary signed URL failure does not lose server-confirmed photo presence',async()=>{
      assert.equal(visible(f),false);assert.ok(f.saveCalls().length);f.d.getElementById('editProfile').click();assert.match(f.d.getElementById('obPhotoBtn').textContent,/Змінити/);
      await f.d.getElementById('saveProfile').onclick();assert.equal(visible(f),false);
    });
  }finally{await close(f)}

  f=await fixture({...existing,photo_url:null,photo_present:false},'en');
  try{
    await check('mandatory photo and validation messages are localized',async()=>{
      assert.match(f.d.getElementById('obPhotoHint').textContent,/Required/);await f.d.getElementById('saveProfile').onclick();assert.match(f.d.getElementById('obPhotoError').textContent,/Add a photo/);
    });
  }finally{await close(f)}
  console.log(`Required profile photo UI checks passed: ${checks}`);
})().catch(error=>{console.error(error);process.exitCode=1});
