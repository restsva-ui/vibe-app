const assert=require('node:assert/strict'),{fixture,pause}=require('./test-profile-bio-ui.cjs');
const profile={name:'PRIVATE NAME',age:28,city:'PRIVATE CITY',bio:'PRIVATE BIO',photo_url:'https://fixture.invalid/private.jpg'};
let pending=null,shares=[],dialogs=[],copied=[],calls=0,deferred=null;
const respond=async(body,fallback)=>{
 if(body.action!=='vibe_quiz_share')return fallback;
 calls++;if(deferred)return deferred;
 return {ok:true,url:'https://t.me/vybe_now_bot?start=qz_'+body.type+'_v123',text:'Public quiz invitation',photo_url:'https://restsva-ui.github.io/vibe-app/assets/vybe-quiz-'+body.type+'-'+body.language+'.jpg',prepared_id:body.native?'prepared-'+calls:null};
};
function beforeEval(w){w.Telegram.WebApp.isVersionAtLeast=()=>true;w.Telegram.WebApp.shareMessage=(id,callback)=>{shares.push(id);pending=callback;};w.Telegram.WebApp.openTelegramLink=url=>dialogs.push(url);w.Telegram.WebApp.shareToStory=(url,params)=>{w.__story={url,params};};Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async text=>copied.push(text)}});}
function answer(f,type){const input=f.d.querySelector('.vibeQuiz input[value="'+type+'"]');input.checked=true;input.dispatchEvent(new f.w.Event('change',{bubbles:true}));f.d.getElementById('quizNext').click();}
let checks=0;const pass=s=>{checks++;console.log('PASS: '+s);};
(async()=>{
 let f=await fixture(profile,'uk',{respond,beforeEval});
 try{
  assert.equal(f.d.getElementById('vibeQuizBtn').hidden,false);f.d.getElementById('vibeQuizBtn').click();await pause();
  assert.equal(f.d.getElementById('quizNext').disabled,true);f.d.getElementById('quizNext').click();assert.match(f.d.querySelector('.quizProgress').textContent,/1 \/ 5/);pass('the optional profile entry requires an answer before moving on');
  answer(f,'spark');answer(f,'talker');f.d.getElementById('quizBack').click();assert.equal(f.d.querySelector('input[value="talker"]').checked,true);answer(f,'spark');answer(f,'spark');answer(f,'spark');answer(f,'spark');
  assert.match(f.d.getElementById('quizHeading').textContent,/Іскра/);assert.deepEqual(JSON.parse(f.w.localStorage.getItem('vybeQuiz:v1:owner')),{type:'spark'});
  const text=f.d.querySelector('.vibeQuiz').textContent;for(const secret of ['PRIVATE NAME','PRIVATE CITY','PRIVATE BIO'])assert.ok(!text.includes(secret));
  assert.equal(f.requests.some(r=>Object.hasOwn(r,'answers')),false);pass('back preserves choices, scoring is correct and only the result is stored');
  const first=f.d.getElementById('quizShare');first.click();first.click();await pause();assert.equal(calls,1);assert.equal(shares.length,1);assert.equal(first.disabled,true);pending(false);await pause();assert.equal(first.disabled,false);assert.deepEqual(dialogs,[]);pass('double taps prepare one card; cancellation never opens another sharing dialog');
  first.click();await pause();pending(true);await pause();assert.match(f.d.getElementById('quizNotice').textContent,/надіслано/);pass('a fresh explicit share can succeed after cancellation');
  f.d.getElementById('quizCopy').click();await pause();assert.equal(copied.length,1);assert.match(copied[0],/qz_spark_v123/);pass('copy retains the inviting user referral code');
  f.d.getElementById('quizStory').click();await pause();assert.match(f.w.__story.url,/quiz-spark-uk\.jpg/);assert.equal(Object.hasOwn(f.w.__story.params,'widget_link'),false);pass('non-Premium story sharing does not request a Premium link widget');
  f.w.setLanguage('en');await pause();assert.match(f.d.getElementById('quizHeading').textContent,/Spark/);assert.match(f.d.querySelector('.quizResultCard').src,/spark-en\.jpg/);pass('language changes retain the result and switch its public artwork');
  let resolve;deferred=new Promise(r=>resolve=r);f.d.getElementById('quizCopy').click();await pause();f.w.openSheet('settings');const html=f.d.getElementById('sheetContent').innerHTML;resolve({ok:true,url:'https://t.me/vybe_now_bot?start=qz_spark_v123',photo_url:'https://restsva-ui.github.io/vibe-app/assets/vybe-quiz-spark-en.jpg',text:'Public quiz invitation'});await pause();assert.equal(f.d.getElementById('sheetContent').innerHTML,html);assert.equal(copied.length,1);deferred=null;pass('late share preparation cannot change a newer screen or copy anything');
  f.d.getElementById('vibeQuizBtn').click();await pause();assert.ok(f.d.getElementById('quizShare'));f.d.getElementById('quizShare').click();await pause();const callback=pending;f.w.enterRestrictedMode('QA',{showNotice:false});await pause();callback(true);assert.equal(f.d.querySelector('.vibeQuiz'),null);assert.equal(f.d.getElementById('vibeQuizBtn').hidden,true);pass('restriction disposes the quiz and ignores a pending native callback');
 }finally{await pause();f.dom.window.close();}
 f=await fixture(profile,'uk',{url:'https://fixture.invalid/?quiz=talker&ref=v777',respond,beforeEval});
 try{assert.ok(f.d.querySelector('.quizOptions'));assert.equal(f.requests.find(r=>r.action==='referral_claim').code,'v777');for(let i=0;i<5;i++)answer(f,'talker');assert.match(f.d.querySelector('.quizComparison').textContent,/однаковий/);pass('a shared invitation claims the original referral and opens the comparison quiz');}finally{await pause();f.dom.window.close();}
 f=await fixture({...profile,bio:''},'uk',{url:'https://fixture.invalid/?quiz=cozy&ref=v777',respond,beforeEval});
 try{assert.equal(f.d.querySelector('.vibeQuiz'),null);assert.equal(f.d.getElementById('vibeQuizBtn').hidden,true);f.d.getElementById('obBio').value='Required bio';await f.d.getElementById('saveProfile').onclick();await pause();assert.ok(f.d.querySelector('.quizOptions'));pass('required profile completion returns the invited person to the quiz');}finally{await pause();f.dom.window.close();}
 f=await fixture(profile,'uk',{respond,beforeEval:w=>{beforeEval(w);delete w.Telegram.WebApp.shareMessage;}});
 try{f.d.getElementById('vibeQuizBtn').click();for(let i=0;i<5;i++)answer(f,'cozy');f.d.getElementById('quizShare').click();await pause();assert.match(dialogs.at(-1),/^https:\/\/t.me\/share\/url\?/);pass('older clients keep an explicit Telegram text invitation fallback');}finally{await pause();f.dom.window.close();}
 console.log('Quiz UI checks passed: '+checks);
})().catch(e=>{console.error(e);process.exitCode=1;});
