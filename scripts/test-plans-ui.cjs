const assert=require('node:assert/strict'),fs=require('node:fs');
const {fixture,pause}=require('./test-profile-bio-ui.cjs');
const profile={name:'QA',age:28,city:'Київ',bio:'Люблю прогулянки',photo_url:'https://ui-fixture.invalid/photo.jpg'};
const id='44444444-4444-4444-8444-444444444444',owner='22222222-2222-4222-8222-222222222222';
const base={id,owner_id:owner,host:{user_id:owner,name:'Host <script>',age:28,photo_url:null},category:'pizza',title:'Pizza <img onerror=alert(1)>',description:'QA <b>text</b>',city:'Київ',venue_label:'Pizzeria',visibility:'private',map_lat:50.45,map_lng:30.5,starts_at:new Date(Date.now()+3600000).toISOString(),ends_at:new Date(Date.now()+3*3600000).toISOString(),capacity:3,approved_count:1,status:'active',my_status:'none',pending_count:0};
const result=p=>({ok:true,plan:p,members:[],requests:[],messages:[],can_chat:false});
let checks=0;
const pass=name=>{checks++;console.log('PASS: '+name)};
(async()=>{
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
    f.w.eval('openPlansMap()');await pause();f.d.getElementById('planToggle').click();await pause();
    assert.equal(f.d.getElementById('sheet').classList.contains('sheetPlans'),true);assert.ok(f.d.querySelector('[data-plan]'));pass('map and list open inside the existing fullscreen sheet');
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
