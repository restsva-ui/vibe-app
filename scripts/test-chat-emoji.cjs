/* Behavior checks for the emoji picker; no live Telegram or Supabase requests. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require(path.join(path.resolve(process.argv[2]||'/tmp/vybe-emoji-test'),'node_modules/jsdom'));
const api=require('../chat-emoji.js');
const source=fs.readFileSync(path.join(__dirname,'../chat-emoji.js'),'utf8');
let checks=0;
function check(name,fn){fn();checks++;console.log('PASS:',name)}
const emojiButton=(panel,emoji)=>[...panel.querySelectorAll('.emojiChoice')].find(b=>b.dataset.emoji===emoji);
const flush=async()=>{for(let i=0;i<4;i++)await Promise.resolve()};
const composerMarkup='<div id="chatMessages" class="chatMessages"></div><div id="chatComposerTools" class="mediaShell chatComposerTools"><span>Повідомлення</span><button type="button" data-record="voice">Голос</button><button type="button" data-record="video">Відео</button></div><div class="chatComposer"><textarea id="chatMessage" maxlength="2000"></textarea><button id="sendMessage" type="button">Надіслати</button></div>';

async function main(){
  check('catalog is unique and searchable in both languages',()=>{
    assert.equal(api.catalog.length,133);assert.equal(new Set(api.catalog.map(x=>x.emoji)).size,133);
    assert.ok(api.searchCatalog('ОбІйМи').some(x=>x.emoji==='🤗'));
    assert.ok(api.searchCatalog('hugs').some(x=>x.emoji==='🤗'));
    assert.ok(api.searchCatalog('coffee').some(x=>x.emoji==='☕'));
    assert.ok(api.searchCatalog('серця').some(x=>x.emoji==='❤️'));
    assert.equal(api.searchCatalog('<img onerror=alert(1)>').length,0);
  });
  check('cursor insertion and selected text replacement preserve surrounding text',()=>{
    assert.equal(api.insertAtSelection('Привіт !',7,7,'🥹').value,'Привіт 🥹!');
    assert.equal(api.insertAtSelection('Кава чи чай?',8,11,'☕').value,'Кава чи ☕?');
    assert.equal(api.insertAtSelection('ab',1,1,'🧑‍💻').value,'a🧑‍💻b');
  });
  check('selection never splits a surrogate pair or a ZWJ emoji',()=>{
    assert.equal(api.insertAtSelection('a🥹b',2,2,'❤️').value,'a🥹❤️b');
    assert.equal(api.insertAtSelection('a🧑‍💻b',3,3,'❤️').value,'a🧑‍💻❤️b');
    assert.equal(api.insertAtSelection('a🧑‍💻b',2,4,'❤️').value,'a❤️b');
  });
  check('message length is enforced without truncating an emoji',()=>{
    const value='a'.repeat(1999),blocked=api.insertAtSelection(value,1999,1999,'🥹');
    assert.equal(blocked.ok,false);assert.equal(blocked.reason,'limit');assert.equal(blocked.value,value);
    assert.equal(api.insertAtSelection('a'.repeat(2000),0,2,'🥹').value.length,2000);
    assert.equal(api.insertAtSelection('hello',0,0,'<img>').reason,'unknown');
  });
  check('large-message styling only accepts one to three complete emoji',()=>{
    for(const value of ['🥹','❤️ 🫶','👨‍👩‍👧‍👦 🇺🇦 🫶🏽','1️⃣','❤️‍🔥'])assert.equal(api.isEmojiMessage(value),true,value);
    for(const value of ['','1','Привіт 😊','a','<svg>','😊😊😊😊'])assert.equal(api.isEmojiMessage(value),false,value);
  });
  check('recent entries reject unknown values and are bounded and deduplicated',()=>{
    assert.deepEqual(api.sanitizeRecents(['🥹','<img src=x>','🥹','☕',null]),['🥹','☕']);
    assert.equal(api.sanitizeRecents(api.catalog.map(x=>x.emoji)).length,24);
    assert.deepEqual(api.sanitizeRecents({emoji:'🥹'}),[]);
  });

  const dom=new JSDOM('<!doctype html><body><div id="sheet" class="sheetChat"><div id="sheetContent">'+composerMarkup+'</div></div></body>',{url:'https://emoji.test/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,d=w.document;w.eval(source);
  let user='owner-A',lang='uk',allowed=true,match='match-A',picked=0,inputEvents=0;
  const content=d.getElementById('sheetContent'),sheet=d.getElementById('sheet');
  let input=d.getElementById('chatMessage');
  input.addEventListener('input',()=>inputEvents++);
  const picker=w.VybeEmoji.create({content,sheet,userId:()=>user,language:()=>lang,allowed:()=>allowed,chat:()=>({matchId:match}),onPick:()=>picked++});
  picker.mount();picker.mount();await flush();
  check('silent refresh mounts exactly one panel and one trigger',()=>{
    assert.equal(d.querySelectorAll('#chatEmojiToggle').length,1);
    assert.equal(d.querySelectorAll('#chatEmojiPicker').length,1);
    assert.equal(d.querySelectorAll('[data-record]').length,2);
  });
  input.value='Привіт !';input.focus();input.setSelectionRange(7,7);
  d.getElementById('chatEmojiToggle').click();
  let panel=d.getElementById('chatEmojiPicker');
  check('opening preserves the draft and dismisses textarea focus',()=>{
    assert.equal(picker.isOpen(),true);assert.equal(input.value,'Привіт !');assert.notEqual(d.activeElement,input);
    assert.equal(panel.querySelectorAll('.emojiChoice').length,24);
    assert.equal(d.getElementById('chatEmojiToggle').getAttribute('aria-expanded'),'true');
  });
  emojiButton(panel,'🥹').click();emojiButton(panel,'❤️').click();
  check('multiple choices insert at the cursor and fire input for typing indicators',()=>{
    assert.equal(input.value,'Привіт 🥹❤️!');assert.equal(input.selectionStart,11);
    assert.equal(inputEvents,2);assert.equal(picked,2);assert.equal(picker.isOpen(),true);assert.notEqual(d.activeElement,input);
    assert.deepEqual(JSON.parse(w.localStorage.getItem('vybeEmojiRecent:owner-A')),['❤️','🥹']);
  });
  picker.mount();await flush();
  check('incoming-message refresh preserves both draft and open panel',()=>{
    assert.equal(input.value,'Привіт 🥹❤️!');assert.equal(picker.isOpen(),true);assert.equal(d.querySelectorAll('#chatEmojiPicker').length,1);
  });
  let search=panel.querySelector('.emojiSearch');search.value='hugs';search.dispatchEvent(new w.Event('input',{bubbles:true}));
  check('search supports English aliases while using Ukrainian labels',()=>{
    assert.ok(emojiButton(panel,'🤗'));assert.equal(emojiButton(panel,'🤗').getAttribute('aria-label'),'Обійми');
  });
  search.value='<img onerror=alert(1)>';search.dispatchEvent(new w.Event('input',{bubbles:true}));
  check('search text is never interpreted as markup',()=>{
    assert.equal(panel.querySelectorAll('.emojiChoice').length,0);assert.equal(panel.querySelector('img'),null);assert.ok(panel.querySelector('.emojiEmpty'));
  });
  picker.close();input.value='Кава чи чай?';input.focus();input.setSelectionRange(8,11);
  d.getElementById('chatEmojiToggle').click();emojiButton(panel,'☕').click();
  check('selected composer text is replaced by a complete emoji',()=>assert.equal(input.value,'Кава чи ☕?'));
  d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  check('Escape closes the picker and restores text editing',()=>{
    assert.equal(picker.isOpen(),false);assert.equal(d.activeElement,input);assert.equal(input.selectionStart,9);
  });
  input.value='a'.repeat(1999);input.setSelectionRange(1999,1999);
  d.getElementById('chatEmojiToggle').click();const before=inputEvents;
  emojiButton(panel,'🥹').click();
  check('full drafts are kept intact and show an inline limit message',()=>{
    assert.equal(input.value,'a'.repeat(1999));assert.equal(inputEvents,before);
    assert.ok(panel.querySelector('.emojiNotice').textContent);assert.equal(picker.isOpen(),true);
  });
  const draft=d.createElement('div');draft.id='mediaDraft';content.prepend(draft);await flush();
  check('recording or a media draft closes and disables emoji selection',()=>{
    assert.equal(picker.isOpen(),false);assert.equal(d.getElementById('chatEmojiToggle').disabled,true);
    emojiButton(panel,'❤️').click();assert.equal(input.value,'a'.repeat(1999));
  });
  draft.remove();await flush();
  check('canceling a recording re-enables the trigger',()=>assert.equal(d.getElementById('chatEmojiToggle').disabled,false));
  d.getElementById('chatEmojiToggle').click();
  const call=d.createElement('div');call.id='vybeCall';d.body.append(call);await flush();
  check('incoming calls close and disable the picker',()=>{
    assert.equal(picker.isOpen(),false);assert.equal(d.getElementById('chatEmojiToggle').disabled,true);
  });
  call.remove();await flush();
  const oldChoice=emojiButton(panel,'❤️');
  content.innerHTML='<h2>Профіль</h2>';await flush();
  check('opening a profile disposes the panel and detaches old listeners',()=>{
    assert.equal(picker.isOpen(),false);assert.equal(d.getElementById('chatEmojiPicker'),null);
    oldChoice.click();assert.equal(inputEvents,before);
  });

  content.innerHTML=composerMarkup;input=d.getElementById('chatMessage');user='owner-B';match='match-B';
  picker.mount();d.getElementById('chatEmojiToggle').click();panel=d.getElementById('chatEmojiPicker');
  panel.querySelector('[aria-label="Нещодавні"]').click();
  check('another Telegram account does not inherit recent emoji',()=>{
    assert.equal(panel.querySelectorAll('.emojiChoice').length,0);
    assert.equal(w.localStorage.getItem('vybeEmojiRecent:owner-B'),null);
  });
  picker.dispose();
  w.localStorage.setItem('vybeEmojiRecent:owner-B',JSON.stringify(['<svg onload=alert(1)>','🥹','🥹',17]));
  picker.mount();d.getElementById('chatEmojiToggle').click();panel=d.getElementById('chatEmojiPicker');
  check('tampered recent storage is sanitized before rendering',()=>{
    assert.equal(panel.querySelectorAll('.emojiChoice').length,1);assert.ok(emojiButton(panel,'🥹'));
    assert.equal(panel.querySelector('.emojiGrid svg'),null);
  });
  allowed=false;picker.mount();await flush();
  check('account restriction removes the picker',()=>assert.equal(d.getElementById('chatEmojiToggle'),null));
  allowed=true;lang='en';picker.mount();d.getElementById('chatEmojiToggle').click();
  check('picker labels follow the app language',()=>{
    assert.equal(d.getElementById('chatEmojiToggle').getAttribute('aria-label'),'Emoji');
    assert.ok(d.querySelector('[aria-label="Search emoji"]'));assert.ok(d.querySelector('[aria-label="Close emoji"]'));
  });
  sheet.classList.add('hidden');await flush();
  check('closing the chat releases the panel',()=>assert.equal(d.getElementById('chatEmojiPicker'),null));
  picker.destroy();

  sheet.classList.remove('hidden');input.value='';
  const offline=w.VybeEmoji.create({content,sheet,userId:()=>user,language:()=>lang,chat:()=>({matchId:match}),storage:{getItem(){throw Error('blocked')},setItem(){throw Error('quota')}}});
  offline.mount();d.getElementById('chatEmojiToggle').click();
  emojiButton(d.getElementById('chatEmojiPicker'),'☕').click();offline.dispose();offline.mount();d.getElementById('chatEmojiToggle').click();
  check('emoji and in-memory recents still work when storage is unavailable',()=>{
    assert.equal(input.value,'☕');assert.ok(emojiButton(d.getElementById('chatEmojiPicker'),'☕'));
    assert.equal(d.getElementById('chatEmojiPicker').querySelectorAll('.emojiChoice').length,1);
  });
  offline.destroy();w.close();

  check('the module is loaded before app.js',()=>{
    const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
    assert.ok(html.includes('chat-emoji.css'));assert.ok(html.indexOf('chat-emoji.js')<html.indexOf('./app.js?'));
  });
  console.log('VYBE emoji checks passed:',checks);
}
main().catch(error=>{console.error(error);process.exitCode=1});
