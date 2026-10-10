const assert=require('node:assert/strict'),fs=require('node:fs');
const {fixture,input,pause}=require('./test-profile-bio-ui.cjs');
const campaignSource=fs.readFileSync('campaign-attribution.js','utf8');
const events=f=>f.requests.filter(r=>r.event);
const options={url:'https://ui-fixture.invalid/?campaign=tt_261011_plans',beforeEval:w=>w.eval(campaignSource)};
async function close(f){await pause();f.dom.window.close()}

(async()=>{
  let f=await fixture(null,'uk',options);
  try{
    const opened=events(f).find(r=>r.event==='app_open');
    assert.equal(opened.properties.campaign_id,'261011_plans');
    assert.equal(opened.properties.campaign_source,'tiktok');
    assert.equal(opened.properties.distinct_id,'owner');
    for(const key of ['name','bio','city','initData','profile_photo'])assert.equal(Object.hasOwn(opened.properties,key),false);
    input(f,'obAge','28');input(f,'obBio','Мій опис');
    f.w.Image=class {constructor(){this.naturalWidth=900;this.naturalHeight=900}set src(v){f.w.setTimeout(()=>this.onload(),0)}};
    f.w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){}});
    f.w.HTMLCanvasElement.prototype.toDataURL=()=> 'data:image/webp;base64,dGVzdA==';
    Object.defineProperty(f.d.getElementById('obPhotoInput'),'files',{value:[new f.w.File(['image'],'photo.png',{type:'image/png'})]});
    await f.d.getElementById('obPhotoInput').onchange();
    f.rejectNextPhoto();await f.d.getElementById('saveProfile').onclick();
    assert.equal(events(f).filter(r=>r.event==='profile_created').length,0,'failed registration cannot count as a created profile');
    f.acceptPhoto();await f.d.getElementById('saveProfile').onclick();
    const created=events(f).filter(r=>r.event==='profile_created');
    assert.equal(created.length,1);assert.equal(created[0].properties.campaign_id,'261011_plans');
    assert.equal(events(f).filter(r=>r.event==='profile_saved').at(-1).properties.is_first_profile,true);
    f.d.getElementById('editProfile').click();input(f,'obBio','Інший опис');await f.d.getElementById('saveProfile').onclick();
    assert.equal(events(f).filter(r=>r.event==='profile_created').length,1,'editing must not inflate new profiles');
    assert.equal(events(f).filter(r=>r.event==='profile_saved').at(-1).properties.is_first_profile,false);
    f.d.getElementById('settingsBtn').click();f.d.getElementById('analyticsToggleBtn').click();
    assert.equal(f.w.localStorage.getItem('vybeCampaign:owner'),null);
    const count=events(f).length;
    f.d.getElementById('editProfile').click();input(f,'obBio','Без аналітики');await f.d.getElementById('saveProfile').onclick();
    assert.equal(events(f).length,count,'analytics opt-out must stop all captures');
  }finally{await close(f)}
  f=await fixture(null,'uk',{beforeEval:options.beforeEval});
  try{assert.equal(Object.hasOwn(events(f).find(r=>r.event==='app_open').properties,'campaign_id'),false,'untagged entry must remain unattributed')}finally{await close(f)}
  console.log('Campaign UI: authenticated opens, successful first save, edit exclusion, opt-out and unattributed entry passed');
})().catch(error=>{console.error(error);process.exitCode=1});
