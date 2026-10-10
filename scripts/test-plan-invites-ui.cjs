const assert=require('node:assert/strict'),{fixture,pause}=require('./test-profile-bio-ui.cjs');
const id='44444444-4444-4444-8444-444444444444',token='55555555-5555-4555-8555-555555555555';
const p={id,category:'pizza',title:'Pizza <img onerror=alert(1)>',city:'Київ',venue_label:'Pizzeria',visibility:'private',starts_at:new Date(Date.now()+3600000).toISOString(),ends_at:new Date(Date.now()+7200000).toISOString(),capacity:4,approved_count:1};
const profile={name:'QA',age:28,city:'Київ',bio:'Люблю каву',photo_url:'https://fixture.invalid/photo.jpg'};
let enabled=false,reminder=false,defer=null,shareCalls=0,downloads=[],shares=[];
const respond=async(b,fallback,url)=>{
 if(String(url).includes('/plan-invite?token='))return {ok:true,plan:p};
 if(b.action==='plans_invite_get')return defer||{ok:true,enabled,plan:p};
 if(b.action==='plans_invite_update'){enabled=b.enabled;return {ok:true,enabled,plan:p};}
 if(b.action==='plans_share'){shareCalls++;return {ok:true,url:'https://restsva-ui.github.io/vibe-app/?invite='+token,prepared_id:'prepared',text:'Public invitation'};}
 if(b.action==='plans_invite_preview')return {ok:true,plan:p};
 if(b.action==='plans_reminder_get')return {ok:true,enabled:reminder,delivered:false};
 if(b.action==='plans_reminder_set'){reminder=b.enabled;return {ok:true,enabled:reminder};}
 if(b.action==='plans_calendar')return {ok:true,url:'https://fixture.invalid/calendar',filename:'VYBE-meetup.ics'};
 if(b.action==='plans_get')return {ok:true,plan:{...p,status:'active',my_status:'host',owner_id:'owner',host:{user_id:'owner',name:'QA',age:28}},members:[],messages:[],requests:[],can_chat:true};
 return fallback;
};
let checks=0;const pass=s=>{checks++;console.log('PASS: '+s)};
(async()=>{
 let f=await fixture(profile,'uk',{respond,beforeEval:w=>{w.Telegram.WebApp.shareMessage=(id,cb)=>{shares.push(id);cb(false)};w.Telegram.WebApp.downloadFile=data=>downloads.push(data);w.Telegram.WebApp.isVersionAtLeast=()=>true;}});
 try{
  f.w.eval('openPlanExtras("'+id+'",true,"invitation")');await pause();assert.equal(f.d.querySelector('.inviteCard h3').textContent,p.title);assert.equal(f.d.querySelector('.inviteCard img'),null);assert.equal(f.d.getElementById('inviteShare'),null);pass('host reviews escaped public fields before publishing');
  f.d.getElementById('inviteToggle').click();await pause();await pause();assert.ok(f.d.getElementById('inviteShare'));assert.equal(f.requests.find(b=>b.action==='plans_invite_update').enabled,true);pass('sharing is enabled by an explicit host action');
  f.d.getElementById('inviteShare').click();f.d.getElementById('inviteShare').click();await pause();assert.equal(shareCalls,1);assert.deepEqual(shares,['prepared']);assert.equal(f.d.getElementById('inviteLink').textContent,'');pass('repeated taps create one native share and cancelling does not trigger a second dialog');
  f.d.getElementById('inviteCopy').click();await pause();assert.match(f.d.getElementById('inviteLink').textContent,/\?invite=/);pass('copy fallback exposes only the public invitation URL');
  f.d.getElementById('inviteShare').click();await pause();assert.equal(shareCalls,2);pass('a later native share gets a fresh prepared message and rechecks access');
  f.d.getElementById('inviteToggle').click();await pause();await pause();assert.equal(f.d.getElementById('inviteShare'),null);pass('disabled invitations remove sharing controls');
  f.w.eval('openPlanExtras("'+id+'",true,"planning")');await pause();assert.equal(f.d.getElementById('planReminder').getAttribute('aria-pressed'),'false');f.d.getElementById('planReminder').click();await pause();await pause();assert.equal(f.d.getElementById('planReminder').getAttribute('aria-pressed'),'true');f.d.getElementById('planCalendar').click();await pause();assert.deepEqual(JSON.parse(JSON.stringify(downloads)),[{url:'https://fixture.invalid/calendar',file_name:'VYBE-meetup.ics'}]);pass('per-plan reminder opt-in and native calendar download work');
  let resolve;defer=new Promise(r=>resolve=r);f.w.eval('openPlanExtras("'+id+'",true,"invitation")');await pause();f.w.eval('openSheet("settings")');await pause();const saved=f.d.getElementById('sheetContent').innerHTML;resolve({ok:true,enabled:true,plan:p});await pause();assert.equal(f.d.getElementById('sheetContent').innerHTML,saved);defer=null;pass('late invitation responses cannot replace a newer sheet');
  f.w.eval('openPlanExtras("'+id+'",true,"planning")');await pause();f.w.eval('enterRestrictedMode("QA",{showNotice:false})');await pause();assert.equal(f.d.getElementById('planCalendar'),null);pass('restriction clears calendar and invitation views');
 }finally{f.dom.window.close();}
 f=await fixture({...profile,bio:''},'uk',{url:'https://ui-fixture.invalid/?invite='+token,respond});
 try{
  assert.ok(f.d.getElementById('inviteJoin'));assert.equal(f.d.getElementById('onboarding').classList.contains('hidden'),true);assert.equal(f.requests.some(b=>b.action==='plans_apply'),false);pass('an incomplete profile sees the invitation before the form');
  f.d.getElementById('inviteJoin').click();await pause();assert.equal(f.d.getElementById('onboarding').classList.contains('hidden'),false);f.d.getElementById('obBio').value='Люблю нові знайомства';f.d.getElementById('saveProfile').click();for(let i=0;i<100&&!f.d.getElementById('planInvite');i++)await pause();assert.ok(f.d.getElementById('planInvite'),JSON.stringify(f.requests.map(b=>b.action)));assert.equal(f.requests.some(b=>b.action==='plans_apply'),false);assert.equal(f.w.location.search,'');pass('saving the profile returns to the exact plan without applying automatically');
 }finally{f.dom.window.close();}
 f=await fixture(null,'en',{url:'https://ui-fixture.invalid/?invite='+token,respond,expectHydration:false,beforeEval:w=>{w.Telegram.WebApp.initData='';w.localStorage.removeItem('vybe18');}});
 try{assert.ok(f.d.getElementById('inviteJoin'));assert.equal(f.requests.some(b=>b.action==='me'),false);assert.equal(f.d.getElementById('onboarding').classList.contains('hidden'),true);assert.equal(f.d.getElementById('sheetContent').textContent.includes('SECRET'),false);pass('browser guests get only a safe invitation without Telegram authentication');}finally{f.dom.window.close();}
 console.log('Plan invitation UI checks passed: '+checks);
})().catch(e=>{console.error(e);process.exitCode=1});
