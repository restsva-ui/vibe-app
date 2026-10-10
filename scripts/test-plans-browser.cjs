/* Real Chromium + actual app files, with all network requests isolated to fixtures. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const dependencies=process.argv[2]||'/tmp/vybe-browser-test';
const requireFixture=createRequire(path.resolve(dependencies,'package.json'));
const chromium=requireFixture('@sparticuz/chromium'),{chromium:browserType}=requireFixture('playwright');
chromium.setGraphicsMode=false;
const repo=process.cwd(),output=process.argv[3]||'/tmp/vybe-plans-qa';fs.mkdirSync(output,{recursive:true});
const tile=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWhkAAAAASUVORK5CYII=','base64');
const meeting=new Date(Date.now()+86400000);meeting.setUTCHours(18,30,0,0);
const seed={id:'44444444-4444-4444-8444-444444444444',owner_id:'host',host:{user_id:'host',name:'Олена',age:27,photo_url:'https://vybe-ui.test/assets/vybe-logo.jpg'},category:'pizza',title:'Піца й розмова після роботи',description:'Збираємося за піцою, знайомимося й ділимося планами на вихідні. Кожен оплачує своє замовлення.',city:'Київ',venue_label:'Піцерія біля парку',visibility:'public',map_lat:50.45,map_lng:30.5,starts_at:meeting.toISOString(),ends_at:new Date(meeting.getTime()+2*3600000).toISOString(),capacity:4,approved_count:2,status:'active',my_status:'none',pending_count:0};
(async()=>{
 const browser=await browserType.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});
 const context=await browser.newContext({deviceScaleFactor:1,timezoneId:'Europe/Kyiv'});
 try{
  for(const [width,height] of [[320,568],[390,844],[430,932]].filter(([w])=>!process.env.VYBE_BROWSER_QA_WIDTH||String(w)===process.env.VYBE_BROWSER_QA_WIDTH)){
   const page=await context.newPage();await page.setViewportSize({width,height});const errors=[],requests=[];let plan={...seed},created=null,inviteEnabled=false,reminderEnabled=false;
   const profile={user_id:'viewer',name:'Test',age:28,city:'Київ',bio:'Люблю прогулянки і нові знайомства',photo_present:true,photo_url:'https://vybe-ui.test/assets/vybe-logo.jpg',interests:['food'],map_enabled:false};
   page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(({height})=>{const noop=()=>{};window.Telegram={WebApp:{initData:'browser-fixture-init-data',initDataUnsafe:{user:{id:1,first_name:'Test'}},ready:noop,expand:noop,setHeaderColor:noop,setBackgroundColor:noop,enableClosingConfirmation:noop,viewportStableHeight:height,BackButton:{show:noop,hide:noop,onClick:noop},HapticFeedback:{notificationOccurred:noop,impactOccurred:noop},showAlert:noop,showConfirm:(_,cb)=>cb(true),isVersionAtLeast:()=>true,shareMessage:(id,cb)=>{window.__sharedPlan=id;cb(false);},downloadFile:params=>{window.__calendarDownload=params;}}};localStorage.clear();localStorage.setItem('vybe18','yes');localStorage.setItem('vybeAnalytics','false');},{height});
   await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.hostname==='qifxxzpnuxchnkowxzgp.supabase.co'&&url.pathname.endsWith('/telegram-auth')){
     const b=request.postDataJSON()||{};requests.push(b);let r={ok:true};
     switch(b.action){
      case 'me':r={ok:true,authenticated:true,user:{id:1}};break;
      case 'profile_get':r={ok:true,user_id:'viewer',profile};break;
      case 'save_profile':r={ok:true,user_id:'viewer',profile,photo_present:true};break;
      case 'discover':r={ok:true,people:[],pagination:{has_more:false}};break;
      case 'discover_map':r={ok:true,people:[]};break;
      case 'matches':r={ok:true,matches:[],unread_total:0};break;
      case 'entitlements':r={ok:true,balances:{supervybe:0,spotlight:0}};break;
      case 'notification_settings_get':r={ok:true,preferences:{likes:true,matches:true,messages:true}};break;
      case 'plans_list':r={ok:true,plans:[plan].filter(p=>(!b.category||p.category===b.category)&&(!b.starts_from||p.starts_at>=b.starts_from&&p.starts_at<b.starts_before))};break;
      case 'plans_my':r={ok:true,plans:created?[created]:[plan]};break;
      case 'plans_get':{const p=created?.id===b.plan_id?created:plan;const member=['host','approved'].includes(p.my_status);r={ok:true,plan:{...p,...(member?{meeting_details:'SECRET PRIVATE MEETING ADDRESS'}:{})},members:member?[p.host]:[],requests:p.my_status==='host'?[{user_id:'peer',status:'pending',note:'Хочу долучитися до компанії',profile:{user_id:'peer',name:'Дмитро',age:29,photo_url:null}}]:[],messages:member?[{id:'m1',sender_id:'host',sender:p.host,body:'Привіт! Домовимося про деталі тут.',created_at:new Date().toISOString()}]:[],can_chat:member};break;}
      case 'plans_invite_get':r={ok:true,enabled:inviteEnabled,plan:created||plan};break;
      case 'plans_invite_update':inviteEnabled=b.enabled;r={ok:true};break;
      case 'plans_share':r={ok:true,url:'https://restsva-ui.github.io/vibe-app/?invite=55555555-5555-4555-8555-555555555555',text:'Invitation',prepared_id:'prepared-fixture'};break;
      case 'plans_invite_preview':r={ok:true,plan:seed};break;
      case 'plans_reminder_get':r={ok:true,enabled:reminderEnabled};break;
      case 'plans_reminder_set':reminderEnabled=b.enabled;break;
      case 'plans_calendar':r={ok:true,url:'https://qifxxzpnuxchnkowxzgp.supabase.co/functions/v1/plan-invite?calendar=55555555-5555-4555-8555-555555555555',filename:'VYBE-meetup.ics'};break;
      case 'plans_apply':plan.my_status='pending';break;
      case 'plans_leave':plan.my_status='left';break;
      case 'plans_respond':created.approved_count++;break;
      case 'plans_create':created={...b,id:'55555555-5555-4555-8555-555555555555',host:{user_id:'viewer',name:'Test',age:28,photo_url:profile.photo_url},owner_id:'viewer',approved_count:1,pending_count:1,my_status:'host',status:'active',ends_at:new Date(Date.now()+4*3600000).toISOString()};r={ok:true,plan:created};break;
      case 'plans_cancel':created.status='cancelled';break;
     }
     return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(r)});
    }
    if(url.hostname==='qifxxzpnuxchnkowxzgp.supabase.co'&&url.pathname.endsWith('/plan-invite'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,plan:seed})});
    if(url.hostname.endsWith('.tile.openstreetmap.org'))return route.fulfill({status:200,contentType:'image/png',body:tile});
    if(url.hostname==='vybe-ui.test'){const file=path.resolve(repo,url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1)));assert.ok(file.startsWith(repo+'/'));if(fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});return route.fulfill({status:404,body:''});}
    return route.fulfill({status:200,contentType:url.pathname.endsWith('.js')?'application/javascript':'application/json',body:url.pathname.endsWith('.js')?'':'{}'});
   });
   await page.goto('https://vybe-ui.test/',{waitUntil:'load'});await page.waitForFunction(()=>document.getElementById('startGuideBtn').hidden===false);await page.locator('#vibeSplash').waitFor({state:'detached'});
   await page.locator('#mapBtn').click();await page.locator('#mapPlans').click();await page.locator('#planShowList').waitFor();
   let layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,map:document.getElementById('planMap').getBoundingClientRect().toJSON(),create:document.getElementById('planCreate').getBoundingClientRect().toJSON()}));
   assert.equal(await page.locator('#planExit').isVisible(),true);assert.equal(layout.overflow,false);assert.ok(layout.map.height>=120,JSON.stringify(layout));assert.ok(layout.create.bottom<=height+1,JSON.stringify(layout));
   if(width===390)await page.screenshot({path:path.join(output,'plans-map.png')});
   assert.equal(await page.locator('#planDay').count(),0);await page.locator('#planWhen').click();await page.locator('#planFilterDate').waitFor();
   const date=await page.evaluate(iso=>vybePlanLocalDate(new Date(iso)),seed.starts_at);await page.locator('#planFilterDate').fill(date);await page.locator('#planFilterAllDay').uncheck();await page.locator('#planFilterFrom').fill('18:00');await page.locator('#planFilterTo').fill('23:00');
   const pickerLayout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,formOverflow:document.getElementById('planWhenForm').scrollWidth>document.getElementById('planWhenForm').clientWidth+1,apply:document.querySelector('.planDateFooter .primary').getBoundingClientRect().toJSON()}));assert.equal(pickerLayout.overflow,false);assert.equal(pickerLayout.formOverflow,false);assert.ok(pickerLayout.apply.bottom<=height+1,JSON.stringify(pickerLayout));
   if(width===390)await page.screenshot({path:path.join(output,'plan-date-picker.png')});await page.locator('.planDateFooter .primary').click();await page.locator('#planShowList').waitFor();
   const filtered=requests.filter(r=>r.action==='plans_list').at(-1),endpoints=await page.evaluate(date=>({from:new Date(date+'T18:00').toISOString(),before:new Date(date+'T23:00').toISOString()}),date);assert.equal(filtered.starts_from,endpoints.from);assert.equal(filtered.starts_before,endpoints.before);assert.ok((await page.locator('#planWhen').textContent()).includes('18:00–23:00'));
   if(width===390)await page.screenshot({path:path.join(output,'plans-filtered-map.png')});
   await page.locator('#planToggle').click();await page.locator('[data-plan]').click();await page.locator('#planApply').waitFor();assert.equal(await page.locator('.plansShell').textContent().then(x=>x.includes('SECRET PRIVATE')),false);
   await page.locator('#planNote').fill('Долучуся після роботи');await page.locator('#planApply').click();await page.locator('.planAddress').waitFor();assert.equal(await page.locator('#planMessageForm').count(),0);
   plan.my_status='approved';plan.visibility='private';await page.evaluate(id=>openPlansMap(id),plan.id);await page.locator('#planMessageForm').waitFor();assert.ok((await page.locator('.planAddress').textContent()).includes('SECRET PRIVATE'));
   await page.locator('#planMessage').fill('Привіт, буду вчасно!');await page.locator('#planSend').click();await page.waitForFunction(()=>document.getElementById('planMessage')?.value==='');
   if(width===390)await page.screenshot({path:path.join(output,'plans-approved.png')});
   await page.locator('#planBack').click();await page.locator('#planCreate').click();await page.locator('#planField_category').selectOption('celebration');await page.locator('#planField_title').fill('День народження у дружній компанії');await page.locator('#planField_description').fill('Настільні ігри, музика, чай і торт.');await page.locator('#planField_capacity').fill('8');await page.locator('#planField_visibility').selectOption('private');await page.locator('#planField_venue_label').fill('Подільський район');await page.locator('#planField_meeting_details').fill('PRIVATE QA HOME ADDRESS');
   await page.locator('#planPick').click();await page.waitForFunction(()=>document.getElementById('planPickConfirm')?.disabled===false);await page.locator('#planPickConfirm').click();assert.equal(await page.locator('#planField_title').inputValue(),'День народження у дружній компанії');
   layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,formOverflow:document.getElementById('planForm').scrollWidth>document.getElementById('planForm').clientWidth+1}));assert.equal(layout.overflow,false);assert.equal(layout.formOverflow,false);
   if(width===390)await page.screenshot({path:path.join(output,'plans-create.png')});
   await page.locator('#planPublish').click();await page.locator('[data-approve]').waitFor();assert.ok(created);assert.equal(created.visibility,'private');assert.equal(created.capacity,8);
   await page.locator('[data-approve]').click();await page.waitForFunction(()=>document.querySelector('.planBadges')?.textContent.includes('2/8'));await page.locator('#planInvite').click();await page.locator('#inviteToggle').waitFor();assert.equal(await page.locator('#inviteShare').count(),0);
   await page.locator('#inviteToggle').click();await page.locator('#inviteShare').waitFor();assert.equal(await page.locator('.planExtrasShell').textContent().then(x=>x.includes('PRIVATE QA HOME ADDRESS')),false);
   let extrasLayout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,card:document.querySelector('.inviteCard').getBoundingClientRect().toJSON()}));assert.equal(extrasLayout.overflow,false);assert.ok(extrasLayout.card.width<=width);if(width===390)await page.screenshot({path:path.join(output,'plan-invitation.png')});
   await page.locator('#inviteShare').click();await page.waitForFunction(()=>window.__sharedPlan==='prepared-fixture');await page.locator('#extrasBack').click();await page.locator('#planPlanning').click();await page.locator('#planReminder').waitFor();
   await page.locator('#planReminder').click();await page.waitForFunction(()=>document.getElementById('planReminder')?.getAttribute('aria-pressed')==='true');await page.locator('#planCalendar').click();await page.waitForFunction(()=>window.__calendarDownload?.file_name==='VYBE-meetup.ics');
   if(width===390)await page.screenshot({path:path.join(output,'plan-reminder.png')});await page.locator('#extrasBack').click();await page.locator('#planCancel').click();await page.waitForFunction(()=>document.querySelector('.plansShell')?.textContent.includes('План скасовано.'));
   assert.equal(await page.evaluate(()=>Object.keys(localStorage).some(k=>(localStorage.getItem(k)||'').includes('PRIVATE QA HOME ADDRESS'))),false);
   await page.locator('#planExit').click();await page.locator('#sheet').waitFor({state:'hidden'});assert.equal(await page.locator('.planAddress').count(),0);assert.equal(errors.length,0,errors.join('\n'));assert.equal(requests.some(r=>['message_send','like','super_like'].includes(r.action)),false);
   const applications=requests.filter(r=>r.action==='plans_apply').length;await page.goto('https://vybe-ui.test/?invite=55555555-5555-4555-8555-555555555555',{waitUntil:'load'});await page.locator('#inviteJoin').waitFor();await page.locator('#vibeSplash').waitFor({state:'detached'});assert.equal(await page.locator('#onboarding').isVisible(),false);assert.equal(await page.locator('.planExtrasShell').textContent().then(x=>x.includes('SECRET PRIVATE')),false);
   if(width===390)await page.screenshot({path:path.join(output,'plan-invitation-preview.png')});await page.locator('#inviteJoin').click();await page.locator('#planPlanning').waitFor();assert.equal(requests.filter(r=>r.action==='plans_apply').length,applications);
   console.log(`PASS Chromium ${width}×${height}: date/time calendar and filtered map/list, invitations, guest preview, native share hooks, calendar/reminder hooks, consent, member chat, private creation, approvals, cancellation and layout.`);
   await page.close();
  }
 }finally{await context.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
