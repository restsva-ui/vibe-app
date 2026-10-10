const assert=require('node:assert/strict');
const {fixture,pause}=require('./test-profile-bio-ui.cjs');
const profile={name:'QA',age:28,city:'Київ',bio:'Люблю прогулянки',photo_url:'https://ui-fixture.invalid/photo.jpg'};
const snapshot='2026-10-10T22:00:00.123456+00:00',first={id:'11111111-1111-4111-8111-111111111111',display_name:'<svg onload="bad()">Ірина</svg>',username:'qa_<tag>',registered_at:'2026-10-10T21:30:00Z',has_profile:true,profile_created_at:'2026-10-10T21:35:00Z',last_seen:'2026-10-10T21:40:00Z'},second={id:'22222222-2222-4222-8222-222222222222',display_name:'Олег',registered_at:null,has_profile:false},third={id:'33333333-3333-4333-8333-333333333333',display_name:'Анна',registered_at:'2026-10-09T12:00:00Z',has_profile:false};
const next={id:second.id,registered_at:null,snapshot_at:snapshot};
const result=(users,extra={})=>({ok:true,admin_role:'owner',registrations:{users,total:users.length,snapshot_at:snapshot,has_more:false,next_cursor:null,...extra}});
let checks=0;
(async()=>{
 for(const role of [null,'admin','owner']){
  let total=1423,fail=false,denied=false;
  const f=await fixture(profile,'uk',{respond:async(body,fallback)=>{
   if(body.action==='profile_get'||body.action==='support_counts')return {...fallback,admin_role:role};
   if(body.action==='entitlements')return {ok:true,owner_access:role==='owner',balances:{supervybe:0,spotlight:0},vybe_plus_until:null};
   if(body.action==='star_catalog')return {ok:true,products:[{product_key:'supervybe_5',title_uk:'5 SuperVYBE',description_uk:'Для зустрічей',stars:10}]};
   if(body.action==='admin_growth_summary')return fail?{ok:false}:{ok:true,admin_role:role,counts:{users_total:total,profiles_total:1001,new_users_today:23,new_profiles_today:19,new_users_7d:150,active_users_7d:234,snapshot_at:'2026-10-10T19:00:00Z',notifications_enabled:role==='owner'}};
   if(body.action==='admin_registrations_list'){
    if(denied)return {ok:false,error:'OWNER_REQUIRED'};
    if(fail)return {ok:false};
    if(body.range==='today')return result([]);
    if(body.range==='week')return result([third]);
    return body.cursor?result([second,third],{total:3}):result([first,second],{total:3,has_more:true,next_cursor:next});
   }
   if(body.action==='likes_received')return {ok:true,people:[]};
   if(body.action==='spotlight_use')return {ok:true};
   return fallback;
  }});
  try{
   assert.equal(f.d.getElementById('adminUsersBtn').classList.contains('hidden'),!role);checks++;
   if(role){
    f.d.getElementById('adminUsersBtn').click();await pause();assert.equal(f.d.querySelectorAll('.adminUserMetrics .adminMetric').length,6);assert.equal(f.d.querySelector('.adminUserMetrics strong').textContent.replace(/\D/g,''),'1423');checks++;
    total=1500;f.d.getElementById('adminUsersRefreshBtn').click();await pause();assert.equal(f.d.querySelector('.adminUserMetrics strong').textContent.replace(/\D/g,''),'1500');checks++;
    fail=true;f.d.getElementById('adminUsersRefreshBtn').click();await pause();assert.ok(f.d.getElementById('adminUsersRetryBtn'));fail=false;f.d.getElementById('adminUsersRetryBtn').click();await pause();assert.ok(f.d.getElementById('adminUsersRefreshBtn'));checks++;
   }else{await f.w.eval('openAdminUsers()');assert.equal(f.requests.some(r=>r.action==='admin_growth_summary'),false);checks++;}
   assert.equal(f.d.getElementById('adminRegistrationsBtn').classList.contains('hidden'),role!=='owner');checks++;
   if(role==='owner'){
    f.d.getElementById('adminRegistrationsBtn').click();await pause();
    assert.equal(f.d.querySelectorAll('.registrationRow').length,2);assert.equal(f.d.querySelector('.registrationRow svg'),null);assert.match(f.d.querySelector('.registrationRow').textContent,/@qa_<tag>/);assert.match(f.d.querySelector('.registrationRow dd').textContent,/11\.10\.2026.*00:30/);assert.match(f.d.querySelectorAll('.registrationRow')[1].textContent,/Без анкети.*Невідомо/);checks++;
    f.d.getElementById('ownerRegistrationsMore').click();await pause();assert.equal(f.d.querySelectorAll('.registrationRow').length,3);assert.equal(f.d.getElementById('ownerRegistrationsMore'),null);assert.equal(f.requests.filter(r=>r.action==='admin_registrations_list').at(-1).cursor.snapshot_at,snapshot);checks++;
    f.d.querySelector('[data-registration-range="today"]').click();await pause();assert.match(f.d.querySelector('.registrationList').textContent,/реєстрацій немає/);assert.equal(f.requests.filter(r=>r.action==='admin_registrations_list').at(-1).cursor,null);checks++;
    f.d.querySelector('[data-registration-range="week"]').click();await pause();assert.equal(f.d.querySelectorAll('.registrationRow').length,1);assert.match(f.d.querySelector('.registrationRow').textContent,/Анна/);checks++;
    f.d.querySelector('[data-registration-range="all"]').click();await pause();f.d.getElementById('ownerRegistrationsRefresh').click();await pause();assert.equal(f.d.querySelectorAll('.registrationRow').length,2);assert.equal(f.requests.filter(r=>r.action==='admin_registrations_list').at(-1).cursor,null);checks++;
    fail=true;f.d.getElementById('ownerRegistrationsMore').click();await pause();assert.equal(f.d.querySelectorAll('.registrationRow').length,2);assert.ok(f.d.getElementById('ownerRegistrationsRetry'));fail=false;f.d.getElementById('ownerRegistrationsRetry').click();await pause();assert.equal(f.d.querySelectorAll('.registrationRow').length,3);checks++;
    f.d.getElementById('ownerRegistrationsRefresh').click();await pause();denied=true;f.d.getElementById('ownerRegistrationsMore').click();await pause();assert.equal(f.d.querySelectorAll('.registrationRow').length,0);assert.match(f.d.querySelector('.ownerRegistrations').textContent,/Доступ лише для власника/);checks++;
    assert.equal([...Array(f.w.localStorage.length)].map((_,i)=>f.w.localStorage.getItem(f.w.localStorage.key(i))).join('').includes('qa_<tag>'),false);checks++;
   }else{await f.w.eval('openOwnerRegistrations()');assert.equal(f.requests.some(r=>r.action==='admin_registrations_list'),false);checks++;}
   await f.w.eval('renderPremiumShop()');assert.equal(f.w.eval('plusActive()'),role==='owner');checks++;
   if(role==='owner'){
    assert.equal(f.d.querySelectorAll('.buyStarBtn').length,0);assert.equal(f.d.getElementById('acceptPurchaseTerms'),null);assert.match(f.d.querySelector('.ownerAccessCard').textContent,/без покупок/);checks++;
    f.d.getElementById('useSpotlight').click();await pause();assert.equal(f.requests.some(r=>r.action==='spotlight_use'),true);checks++;
    await f.w.eval('renderPremiumShop()');f.d.getElementById('whoLikedBtn').click();await pause();assert.equal(f.requests.some(r=>r.action==='likes_received'),true);checks++;
   }else{assert.equal(f.d.querySelectorAll('.buyStarBtn').length,1);assert.equal(f.d.getElementById('useSpotlight'),null);checks++;}
  }finally{f.dom.window.close();}
 }
 for(const mode of ['navigation','filter','close']){
  let finish;
  const stale=await fixture(profile,'uk',{respond:async(b,r)=>{
   if(b.action==='profile_get'||b.action==='support_counts')return {...r,admin_role:'owner'};
   if(b.action==='admin_registrations_list')return b.range==='today'?result([]):await new Promise(resolve=>{finish=resolve;});
   return r;
  }});
  try{
   const pending=stale.w.eval('openOwnerRegistrations()');await pause();assert.ok(finish);
   if(mode==='navigation')stale.d.getElementById('sheetContent').innerHTML='<div id="newPane">Наступний екран</div>';
   if(mode==='filter'){stale.d.querySelector('[data-registration-range="today"]').click();await pause();}
   if(mode==='close')stale.d.getElementById('sheet').classList.add('hidden');
   finish(result([first]));await pending;
   assert.equal(stale.d.querySelectorAll('.registrationRow').length,0);
   if(mode==='navigation')assert.ok(stale.d.getElementById('newPane'));
   if(mode==='filter')assert.match(stale.d.querySelector('.registrationList').textContent,/реєстрацій немає/);
   checks++;
  }finally{stale.dom.window.close();}
 }
 const english=await fixture(profile,'en',{respond:async(b,r)=>b.action==='profile_get'||b.action==='support_counts'?{...r,admin_role:'owner'}:b.action==='admin_registrations_list'?result([second]):r});
 try{await english.w.eval('openOwnerRegistrations()');assert.match(english.d.querySelector('.ownerRegistrations').textContent,/New users.*Registration times are in Kyiv time/);assert.match(english.d.querySelector('.registrationRow').textContent,/No profile.*Registered.*Unknown/);checks++;}finally{english.dom.window.close();}
 const f=await fixture(profile,'en',{respond:async(b,r)=>b.action==='entitlements'?{ok:true,owner_access:true,balances:{supervybe:0,spotlight:0}}:r});
 try{await f.w.eval('renderPremiumShop()');assert.match(f.d.querySelector('.ownerAccessCard').textContent,/without purchases/);checks++;}finally{f.dom.window.close();}
 console.log("Admin users and owner premium UI: "+checks+" checks passed.");
})().catch(e=>{console.error(e);process.exitCode=1;});
