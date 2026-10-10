const assert=require('node:assert/strict');
const {fixture,pause}=require('./test-profile-bio-ui.cjs');
const profile={name:'QA',age:28,city:'Київ',bio:'Люблю прогулянки',photo_url:'https://ui-fixture.invalid/photo.jpg'};
let checks=0;
(async()=>{
 for(const role of [null,'admin','owner']){
  let total=1423,fail=false;
  const f=await fixture(profile,'uk',{respond:async(body,fallback)=>{
   if(body.action==='profile_get'||body.action==='support_counts')return {...fallback,admin_role:role};
   if(body.action==='entitlements')return {ok:true,owner_access:role==='owner',balances:{supervybe:0,spotlight:0},vybe_plus_until:null};
   if(body.action==='star_catalog')return {ok:true,products:[{product_key:'supervybe_5',title_uk:'5 SuperVYBE',description_uk:'Для зустрічей',stars:10}]};
   if(body.action==='admin_growth_summary')return fail?{ok:false}:{ok:true,admin_role:role,counts:{users_total:total,profiles_total:1001,new_users_today:23,new_profiles_today:19,new_users_7d:150,active_users_7d:234,snapshot_at:'2026-10-10T19:00:00Z',notifications_enabled:role==='owner'}};
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
   await f.w.eval('renderPremiumShop()');assert.equal(f.w.eval('plusActive()'),role==='owner');checks++;
   if(role==='owner'){
    assert.equal(f.d.querySelectorAll('.buyStarBtn').length,0);assert.equal(f.d.getElementById('acceptPurchaseTerms'),null);assert.match(f.d.querySelector('.ownerAccessCard').textContent,/без покупок/);checks++;
    f.d.getElementById('useSpotlight').click();await pause();assert.equal(f.requests.some(r=>r.action==='spotlight_use'),true);checks++;
    await f.w.eval('renderPremiumShop()');f.d.getElementById('whoLikedBtn').click();await pause();assert.equal(f.requests.some(r=>r.action==='likes_received'),true);checks++;
   }else{assert.equal(f.d.querySelectorAll('.buyStarBtn').length,1);assert.equal(f.d.getElementById('useSpotlight'),null);checks++;}
  }finally{f.dom.window.close();}
 }
 const f=await fixture(profile,'en',{respond:async(b,r)=>b.action==='entitlements'?{ok:true,owner_access:true,balances:{supervybe:0,spotlight:0}}:r});
 try{await f.w.eval('renderPremiumShop()');assert.match(f.d.querySelector('.ownerAccessCard').textContent,/without purchases/);checks++;}finally{f.dom.window.close();}
 console.log("Admin users and owner premium UI: "+checks+" checks passed.");
})().catch(e=>{console.error(e);process.exitCode=1;});
