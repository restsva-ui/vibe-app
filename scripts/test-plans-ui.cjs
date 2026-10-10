const assert=require('node:assert/strict'),fs=require('node:fs');
const {fixture,pause}=require('./test-profile-bio-ui.cjs');
const profile={name:'QA',age:28,city:'Київ',bio:'Люблю прогулянки',photo_url:'https://ui-fixture.invalid/photo.jpg'};
const id='44444444-4444-4444-8444-444444444444',owner='22222222-2222-4222-8222-222222222222';
const base={id,owner_id:owner,host:{user_id:owner,name:'Host <script>',age:28,photo_url:null},category:'pizza',title:'Pizza <img onerror=alert(1)>',description:'QA <b>text</b>',city:'Київ',venue_label:'Pizzeria',visibility:'private',map_lat:50.45,map_lng:30.5,starts_at:new Date(Date.now()+3600000).toISOString(),ends_at:new Date(Date.now()+3*3600000).toISOString(),capacity:3,approved_count:1,status:'active',my_status:'none',pending_count:0};
const result=p=>({ok:true,plan:p,members:[],requests:[],messages:[],can_chat:false});
let checks=0;
const pass=name=>{checks++;console.log('PASS: '+name)};
(async()=>{
  const oldTimezone=process.env.TZ;process.env.TZ='Europe/Kyiv';
  try{
    const vm=require('node:vm'),context={};vm.createContext(context);vm.runInContext(fs.readFileSync('plans.js','utf8'),context);
    const range=input=>vm.runInContext('vybePlanTimeRange('+JSON.stringify(input)+')',context);
    let r=range({date:'2026-10-25',allDay:true});assert.equal(r.starts_from,'2026-10-24T21:00:00.000Z');assert.equal(r.starts_before,'2026-10-25T22:00:00.000Z');
    r=range({date:'2026-03-29',allDay:true});assert.equal(Date.parse(r.starts_before)-Date.parse(r.starts_from),23*3600000);pass('whole-day ranges follow local midnight on both 23-hour and 25-hour days');
    r=range({date:'2026-10-10',allDay:false,from:'18:30',to:'21:45'});assert.equal(r.starts_from,'2026-10-10T15:30:00.000Z');assert.equal(r.starts_before,'2026-10-10T18:45:00.000Z');pass('local clock times convert to exact UTC instants');
    for(const input of [{date:'2026-02-30'},{date:'2026-10-10',allDay:false,from:'18:00',to:'17:00'},{date:'2026-10-10',allDay:false,from:'24:00',to:'25:00'},{date:'2026-03-29',allDay:false,from:'03:30',to:'05:00'}])assert.equal(range(input),null);pass('invalid dates, reversed windows and nonexistent local times are rejected');
  }finally{if(oldTimezone===undefined)delete process.env.TZ;else process.env.TZ=oldTimezone;}
  let state={...base},deferred=null,failMessage=true;
  let f=await fixture(profile,'uk',{respond:async(body,fallback)=>{
    if(body.action==='plans_list'||body.action==='plans_my')return {ok:true,plans:[state]};
    if(body.action==='plans_get')return {...result(state),can_chat:state.my_status==='approved',members:state.my_status==='approved'?[state.host]:[],messages:state.my_status==='approved'?[{id:'m',sender_id:owner,sender:state.host,body:'QA message <svg onload=alert(1)>',created_at:new Date().toISOString()}]:[]};
    if(body.action==='plans_apply'){state={...state,my_status:'pending'};return {ok:true};}
    if(body.action==='plans_leave'){state={...state,my_status:'left'};delete state.meeting_details;return {ok:true};}
    if(body.action==='plans_message'){if(deferred)return deferred;if(failMessage){failMessage=false;return {ok:false,error:'PLANS_UNAVAILABLE'};}return {ok:true};}
    return fallback;
  }});
  try{
    f.w.eval('loadLeaflet=async()=>{throw new Error("No map tiles in jsdom")};openPlansMap()');await pause();f.d.getElementById('planToggle').click();await pause();
    assert.equal(f.d.getElementById('sheet').classList.contains('sheetPlans'),true);assert.ok(f.d.querySelector('[data-plan]'));pass('map and list open inside the existing fullscreen sheet');
    assert.equal(f.d.getElementById('planDay'),null);assert.match(f.d.getElementById('planWhen').textContent,/Дата й час/);f.d.getElementById('planWhen').click();
    assert.equal(f.d.getElementById('planFilterDate').type,'date');assert.equal(f.d.getElementById('planFilterAllDay').checked,true);assert.equal(f.d.getElementById('planFilterFrom').disabled,true);pass('date selection replaces the preset menu and starts with an optional all-day filter');
    const picked=f.w.eval('vybePlanLocalDate(new Date(Date.now()+2*86400000))');f.d.getElementById('planFilterDate').value=picked;f.d.getElementById('planFilterAllDay').checked=false;f.d.getElementById('planFilterAllDay').dispatchEvent(new f.w.Event('change'));
    f.d.getElementById('planFilterFrom').value='18:00';f.d.getElementById('planFilterTo').value='17:00';const beforeFilter=f.requests.filter(x=>x.action==='plans_list').length;
    f.d.getElementById('planWhenForm').dispatchEvent(new f.w.Event('submit',{cancelable:true}));await pause();assert.equal(f.d.getElementById('planWhenError').hidden,false);assert.equal(f.requests.filter(x=>x.action==='plans_list').length,beforeFilter);pass('reversed time windows stay in the picker without issuing a search');
    f.d.getElementById('planFilterTo').value='22:00';f.d.getElementById('planWhenForm').dispatchEvent(new f.w.Event('submit',{cancelable:true}));await pause();
    const expected={starts_from:new f.w.Date(picked+'T18:00').toISOString(),starts_before:new f.w.Date(picked+'T22:00').toISOString()};let search=f.requests.filter(x=>x.action==='plans_list').at(-1);
    assert.equal(search.starts_from,expected.starts_from);assert.equal(search.starts_before,expected.starts_before);assert.match(f.d.getElementById('planWhen').textContent,/18:00–22:00/);pass('applying a date and time window sends normalized endpoints to the server');
    f.d.getElementById('planCategory').value='pizza';f.d.getElementById('planCategory').dispatchEvent(new f.w.Event('change'));await pause();f.d.getElementById('planToggle').click();await pause();search=f.requests.filter(x=>x.action==='plans_list').at(-1);assert.equal(search.category,'pizza');assert.equal(search.starts_from,expected.starts_from);assert.equal(search.starts_before,expected.starts_before);assert.ok(f.d.getElementById('planMap'));pass('category changes and map/list switching preserve the applied date and clock range');
    f.d.getElementById('planWhen').click();f.d.getElementById('planFilterFrom').value='08:00';f.d.getElementById('planBack').click();await pause();assert.equal(f.requests.filter(x=>x.action==='plans_list').at(-1).starts_from,expected.starts_from);pass('back cancels unsubmitted date edits');
    f.d.getElementById('planWhen').click();f.d.getElementById('planWhenReset').click();await pause();search=f.requests.filter(x=>x.action==='plans_list').at(-1);assert.equal('starts_from' in search,false);assert.equal('starts_before' in search,false);f.d.getElementById('planToggle').click();await pause();pass('reset removes the date window from both map and list searches');
    f.d.querySelector('[data-plan]').click();await pause();
    assert.equal(f.d.querySelector('.planAddress'),null);assert.equal(f.d.getElementById('planMessageForm'),null);assert.equal(f.d.querySelector('.planDetail h3').textContent,base.title);assert.equal(f.d.querySelector('.planDetail img[onerror]'),null);pass('public details escape user content and keep address and chat closed');
    f.d.getElementById('planNote').value='I would like to join';f.d.getElementById('planApply').click();await pause();await pause();assert.match(f.d.querySelector('.planAddress').textContent,/на розгляді/);assert.equal(f.d.getElementById('planMessageForm'),null);assert.equal(f.d.querySelector('.planAddress').textContent.includes('SECRET ADDRESS'),false);pass('an application stays pending until the organizer approves');
    state={...state,my_status:'approved',meeting_details:'SECRET ADDRESS'};f.w.eval('openPlansMap("'+id+'")');await pause();assert.ok(f.d.querySelector('.planAddress').textContent.includes('SECRET ADDRESS'));assert.ok(f.d.getElementById('planMessageForm'));assert.equal(f.d.querySelector('.planMessage svg'),null);pass('approved participants get the address and safely rendered group chat');
    f.d.getElementById('planMessage').value='Meet at the entrance';f.d.getElementById('planMessageForm').dispatchEvent(new f.w.Event('submit',{cancelable:true}));await pause();const first=f.requests.filter(x=>x.action==='plans_message').at(-1);assert.equal(f.d.getElementById('planMessage').value,'Meet at the entrance');assert.equal(f.d.getElementById('planSend').disabled,false);pass('failed sends preserve the message and restore retry');
    f.d.getElementById('planMessageForm').dispatchEvent(new f.w.Event('submit',{cancelable:true}));await pause();await pause();const second=f.requests.filter(x=>x.action==='plans_message').at(-1);assert.equal(first.client_nonce,second.client_nonce);pass('a message retry reuses its nonce instead of duplicating the message');
    f.d.getElementById('planLeave').click();await pause();await pause();assert.equal(f.d.querySelector('.planAddress'),null);assert.equal(f.d.getElementById('planMessageForm'),null);pass('leaving removes the visible address and group chat');
    f.d.getElementById('planBack').click();await pause();f.d.getElementById('planCreate').click();const fields=f.d.getElementById('planForm');assert.ok(fields);assert.equal(f.d.getElementById('planField_capacity').min,'2');assert.equal(f.d.getElementById('planField_capacity').max,'20');f.d.getElementById('planField_title').value='Birthday QA';f.d.getElementById('planField_visibility').value='private';f.d.getElementById('planField_visibility').dispatchEvent(new f.w.Event('change'));assert.match(f.d.getElementById('planLocationHint').textContent,/кілометрів/);pass('create form includes bounded seats and an explicit private-location explanation');
    f.d.getElementById('planForm').dispatchEvent(new f.w.Event('submit',{cancelable:true}));await pause();assert.equal(f.requests.some(x=>x.action==='plans_create'),false);assert.match(f.d.getElementById('planError').textContent,/обери місце/);pass('a missing location cannot publish a plan');
    f.d.getElementById('planBack').click();await pause();f.d.getElementById('planCreate').click();assert.equal(f.d.getElementById('planField_title').value,'Birthday QA');for(let i=0;i<f.w.localStorage.length;i++)assert.equal(f.w.localStorage.getItem(f.w.localStorage.key(i)).includes('Birthday QA'),false);pass('going back preserves the draft in memory');
    state={...state,my_status:'approved',meeting_details:'SECRET ADDRESS'};f.w.eval('openPlansMap("'+id+'")');await pause();
    let resolveSend;deferred=new Promise(resolve=>resolveSend=resolve);f.d.getElementById('planMessage').value='A pending draft';
    const sendCount=f.requests.filter(x=>x.action==='plans_message').length;
    f.d.getElementById('planMessageForm').dispatchEvent(new f.w.Event('submit',{cancelable:true}));
    f.d.getElementById('planMessageForm').dispatchEvent(new f.w.Event('submit',{cancelable:true}));await pause();
    assert.equal(f.requests.filter(x=>x.action==='plans_message').length,sendCount+1);pass('repeated submit while sending creates one request');
    f.w.eval('openSheet("settings")');await pause();const replacement=f.d.getElementById('sheetContent').innerHTML;
    resolveSend({ok:true});await pause();await pause();assert.equal(f.d.getElementById('sheetContent').innerHTML,replacement);assert.equal(f.d.getElementById('planMessageForm'),null);deferred=null;pass('a late send cannot replace a newer Settings sheet');
    f.w.eval('openPlansMap("'+id+'")');await pause();f.w.eval('enterRestrictedMode("QA",{showNotice:false})');await pause();
    assert.equal(f.d.getElementById('sheet').classList.contains('hidden'),true);assert.equal(f.d.getElementById('sheetContent').textContent.includes('SECRET ADDRESS'),false);pass('a runtime restriction clears mounted private plan details');

  }finally{await pause();f.dom.window.close();}
  f=await fixture(profile,'en',{respond:async body=>body.action==='plans_list'?{ok:false,error:'PLANS_UNAVAILABLE'}:null});
  try{f.w.eval('openPlansMap()');await pause();f.d.getElementById('planToggle').click();await pause();assert.ok(f.d.getElementById('planRetry'));assert.match(f.d.querySelector('.plansShell').textContent,/Could not load/);assert.equal(f.d.querySelector('.planCard'),null);pass('loading failures show a retry rather than a false empty map');}finally{await pause();f.dom.window.close();}
  console.log('Plans UI checks passed: '+checks);
})().catch(e=>{console.error(e);process.exitCode=1});
