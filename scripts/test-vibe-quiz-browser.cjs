/* Real Chromium, actual assets and mobile layouts; every network request is a fixture. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const requireBrowser=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/'):createRequire(path.resolve(process.argv[2]||'/tmp/vybe-browser-test','package.json'));
const {chromium:browserType}=requireBrowser('playwright');
const output=path.resolve(process.argv[3]||'/tmp/vybe-quiz-qa');fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await browserType.launch({headless:true,...(process.env.VYBE_BROWSER_EXECUTABLE?{executablePath:process.env.VYBE_BROWSER_EXECUTABLE,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']}: {})});
 try{
  for(const [width,height] of [[320,568],[390,844],[430,932]]){
   const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,timezoneId:'Europe/Kyiv'}),page=await context.newPage(),errors=[],requests=[];
   const profile={name:'PRIVATE NAME',age:28,city:'PRIVATE CITY',bio:'PRIVATE BIO',photo_present:true,photo_url:'https://vybe-ui.test/assets/vybe-logo.jpg',interests:['coffee']};
   page.on('pageerror',error=>errors.push(error.message));
   await page.addInitScript(({height})=>{const noop=()=>{};window.Telegram={WebApp:{initData:'browser-fixture-init-data',initDataUnsafe:{user:{id:1,first_name:'Test'}},ready:noop,expand:noop,setHeaderColor:noop,setBackgroundColor:noop,enableClosingConfirmation:noop,viewportStableHeight:height,BackButton:{show:noop,hide:noop,onClick:noop},HapticFeedback:{notificationOccurred:noop,impactOccurred:noop},showAlert:noop,isVersionAtLeast:()=>true,shareMessage:(id,cb)=>{window.__shares=(window.__shares||[]).concat(id);window.__shareCallback=cb;},openTelegramLink:url=>{window.__dialogs=(window.__dialogs||[]).concat(url);},shareToStory:noop}};localStorage.clear();localStorage.setItem('vybe18','yes');localStorage.setItem('vybeAnalytics','false');Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__copied=text;}}});},{height});
   await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.hostname==='qifxxzpnuxchnkowxzgp.supabase.co'&&url.pathname.endsWith('/telegram-auth')){
     const body=request.postDataJSON();requests.push(body);let result={ok:true};
     switch(body.action){
      case 'me':result={ok:true,authenticated:true,user:{id:1,first_name:'Test'}};break;
      case 'profile_get':result={ok:true,user_id:'fixture',profile};break;
      case 'save_profile':result={ok:true,user_id:'fixture',profile};break;
      case 'discover':result={ok:true,people:[],pagination:{has_more:false}};break;
      case 'matches':result={ok:true,matches:[],unread_total:0};break;
      case 'notification_settings_get':result={ok:true,preferences:{likes:true,matches:true,messages:true}};break;
      case 'vibe_quiz_share':result={ok:true,url:'https://t.me/vybe_now_bot?start=qz_'+body.type+'_v123',text:'Public invitation',photo_url:'https://restsva-ui.github.io/vibe-app/assets/vybe-quiz-'+body.type+'-'+body.language+'.jpg',prepared_id:'prepared'};break;
     }
     return route.fulfill({contentType:'application/json',body:JSON.stringify(result)});
    }
    if(url.hostname==='vybe-ui.test'||(url.hostname==='restsva-ui.github.io'&&url.pathname.startsWith('/vibe-app/assets/'))){
     const pathname=url.hostname==='vybe-ui.test'?url.pathname:url.pathname.slice('/vibe-app'.length);
     const file=path.resolve(process.cwd(),'.'+(pathname==='/'?'/index.html':pathname));
     if(!file.startsWith(process.cwd()+path.sep)||!fs.existsSync(file))return route.abort();
     const ext=path.extname(file),type={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp'}[ext]||'application/octet-stream';
     return route.fulfill({contentType:type,body:fs.readFileSync(file)});
    }
    return route.abort();
   });
   await page.goto('https://vybe-ui.test/');await page.locator('.navItem[data-target="profileView"]').click();await page.locator('#vibeQuizBtn').click();
   const saves=requests.filter(r=>r.action==='save_profile').length;
   assert.equal(await page.locator('#quizNext').isDisabled(),true);
   await page.screenshot({path:path.join(output,width+'-question.png')});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   for(let i=0;i<5;i++){await page.locator('.vibeQuiz input[value="spark"]').check();await page.locator('#quizNext').click();}
   await page.locator('.quizResultCard').evaluate(img=>img.decode());assert.match(await page.locator('#quizHeading').textContent(),/Іскра/);
   assert.equal(requests.filter(r=>r.action==='save_profile').length,saves);assert.ok(!await page.locator('.vibeQuiz').textContent().then(s=>s.includes('PRIVATE')));
   await page.screenshot({path:path.join(output,width+'-result.png')});
   await page.locator('#quizShare').click();await page.waitForFunction(()=>!!window.__shareCallback);await page.evaluate(()=>window.__shareCallback(false));assert.deepEqual(await page.evaluate(()=>window.__dialogs||[]),[]);
   await page.locator('#quizCopy').click();await page.waitForFunction(()=>!!window.__copied);assert.match(await page.evaluate(()=>window.__copied),/qz_spark_v123/);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
   await page.locator('#quizFind').click();assert.equal(await page.locator('#sheet').evaluate(el=>el.classList.contains('hidden')),true);
   console.log('PASS: real mobile quiz, card decoding, sharing cancellation and copy at '+width+' × '+height);
   await context.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
