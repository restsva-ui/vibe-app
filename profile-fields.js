/* Shared list choices for profile creation and editing. Stored values remain language-independent. */
(function(global){
  'use strict';
  const gender=[['Чоловік','Man'],['Жінка','Woman'],['Небінарна особа','Non-binary'],['Інше','Other']];
  const looking=[['Жінок','Women'],['Чоловіків','Men'],['Усіх','Everyone']];
  const aliases={'Київ':'Kyiv Kiev','Львів':'Lviv','Одеса':'Odesa Odessa','Харків':'Kharkiv','Дніпро':'Dnipro','Запоріжжя':'Zaporizhzhia','Вінниця':'Vinnytsia','Івано-Франківськ':'Ivano-Frankivsk','Тернопіль':'Ternopil','Чернівці':'Chernivtsi','Ужгород':'Uzhhorod','Полтава':'Poltava'};
  const popular=['Київ','Львів','Одеса','Харків','Дніпро','Запоріжжя','Вінниця','Івано-Франківськ','Тернопіль','Чернівці','Ужгород','Полтава'];
  const normalize=value=>String(value||'').normalize('NFKC').toLocaleLowerCase('uk-UA').replace(/[’ʼ`']/g,'').replace(/[-\s]+/g,' ').trim();
  function create(config={}){
    const doc=global.document,$=id=>doc.getElementById(id),text=(uk,en)=>config.language?.()==='en'?en:uk;
    const citySelect=$('obCity'),cityButton=$('obCityBtn'),cityValue=$('obCityValue');
    const counts=new Map();
    for(const [name] of global.VybeProfileCities.rows)counts.set(name,(counts.get(name)||0)+1);
    const cities=global.VybeProfileCities.rows.map(([name,region])=>({name,region,value:counts.get(name)>1&&!(name==='Миколаїв'&&region==='Миколаївська')?name+' ('+region+' обл.)':name}));
    cities.sort((a,b)=>a.name.localeCompare(b.name,'uk')||a.region.localeCompare(b.region,'uk'));
    const ordered=[...popular.map(name=>cities.find(c=>c.value===name)).filter(Boolean),...cities.filter(c=>!popular.includes(c.value))];
    const shell=doc.createElement('div');shell.id='obCityDialog';shell.className='profileCityShell';shell.hidden=true;
    shell.setAttribute('role','dialog');shell.setAttribute('aria-modal','true');shell.setAttribute('aria-labelledby','obCityTitle');
    shell.innerHTML='<section class="profileCityCard"><header><h2 id="obCityTitle"></h2><button id="obCityClose" class="profileCityClose" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><label class="profileCitySearchLabel" for="obCitySearch"></label><input id="obCitySearch" class="field" type="search" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="80" aria-controls="obCityResults"><p id="obCityStatus" class="profileCityStatus" role="status" aria-live="polite"></p><div id="obCityResults" class="profileCityResults" role="list"></div></section>';
    doc.body.append(shell);
    const search=$('obCitySearch'),results=$('obCityResults'),status=$('obCityStatus'),closeButton=$('obCityClose');
    let opened=false,origin=null,background=[],hadScrollLock=false;
    const interruption=new global.MutationObserver(()=>{if(opened&&config.interrupted?.())close(false)});
    function option(select,value,label,legacy=false){
      const el=doc.createElement('option');el.value=value;el.textContent=label;
      if(legacy)el.dataset.legacy='true';select.append(el);
    }
    function choices(select,items,value,placeholder){
      const saved=String(value??'');select.replaceChildren();option(select,'',placeholder);
      for(const [key,uk,en] of items)option(select,key,text(uk,en));
      if(saved&&select.id!=='obAge'&&!items.some(([key])=>key===saved))option(select,saved,saved,true);
      select.value=saved;
    }
    function refreshLanguage(){
      choices($('obAge'),Array.from({length:82},(_,i)=>{const v=String(i+18);return[v,v,v]}),$('obAge').value,text('Обери','Choose'));
      choices($('obGender'),gender.map(([uk,en])=>[uk,uk,en]),$('obGender').value,text('Не вказувати','Prefer not to say'));
      choices($('obLooking'),looking.map(([uk,en])=>[uk,uk,en]),$('obLooking').value,text('Не вказувати','Prefer not to say'));
      const saved=citySelect.value;citySelect.replaceChildren();option(citySelect,'',text('Не вказувати','Prefer not to say'));
      for(const city of cities)option(citySelect,city.value,city.value);
      option(citySelect,'За кордоном',text('За кордоном','Abroad'));
      if(saved&&!cities.some(c=>c.value===saved)&&saved!=='За кордоном')option(citySelect,saved,saved,true);
      citySelect.value=saved;updateCity();
      $('obCityTitle').textContent=text('Обери місто','Choose a city');
      closeButton.setAttribute('aria-label',text('Закрити вибір міста','Close city selection'));
      search.placeholder=text('Назва міста або області','City or region name');
      shell.querySelector('label').textContent=text('Пошук міста','Search cities');
      if(opened)renderResults();
    }
    function updateCity(){cityValue.textContent=citySelect.value==='За кордоном'?text('За кордоном','Abroad'):(citySelect.value||text('Обери місто','Choose a city'));cityButton.classList.toggle('isPlaceholder',!citySelect.value)}
    function legacyCity(){const legacy=citySelect.querySelector('option[data-legacy]');return legacy?{value:legacy.value,name:legacy.value,region:'',legacy:true}:null}
    function renderResults(){
      const q=normalize(search.value),tokens=q.split(' ').filter(Boolean),legacy=legacyCity();
      const all=[...(legacy?[legacy]:[]),...ordered,{value:'За кордоном',name:text('За кордоном','Abroad'),region:''}];
      const matches=all.filter(c=>tokens.every(t=>normalize(c.name+' '+c.region+' '+(aliases[c.name]||'')).includes(t)));
      results.replaceChildren();
      const rows=q?matches:[{value:'',name:text('Не вказувати','Prefer not to say'),region:''},...matches];
      for(const city of rows){
        const item=doc.createElement('div');item.setAttribute('role','listitem');
        const button=doc.createElement('button');button.type='button';button.className='profileCityOption';button.dataset.value=city.value;
        button.setAttribute('aria-pressed',String(citySelect.value===city.value));
        const title=doc.createElement('span');title.textContent=city.name;button.append(title);
        if(city.region||city.legacy){const detail=doc.createElement('small');detail.textContent=city.legacy?text('Збережено в твоїй анкеті','Saved in your profile'):(city.region==='Автономна Республіка Крим'?city.region:city.region==='Київ'||city.region==='Севастополь'?text('Україна','Ukraine'):city.region+text(' область',' region'));button.append(detail)}
        button.onclick=()=>{citySelect.value=city.value;citySelect.dispatchEvent(new global.Event('change',{bubbles:true}));close()};
        item.append(button);results.append(item);
      }
      status.textContent=matches.length?text('Знайдено: ','Found: ')+matches.length:text('Місто не знайдено. Спробуй іншу назву або область.','No city found. Try another name or region.');
      results.scrollTop=0;
    }
    function keydown(event){
      if(!opened)return;
      if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();return}
      const buttons=[...results.querySelectorAll('button')];
      if(event.target===search&&event.key==='ArrowDown'&&buttons.length){event.preventDefault();buttons[0].focus();return}
      if(event.target===search&&event.key==='Enter'){event.preventDefault();if(normalize(search.value)&&buttons.length===1)buttons[0].click();return}
      const index=buttons.indexOf(doc.activeElement);
      if(index>=0&&['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
        event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:index+(event.key==='ArrowDown'?1:-1);
        if(next<0)search.focus();else buttons[Math.min(next,buttons.length-1)].focus();return;
      }
      if(event.key==='Tab'){
        const focusable=[closeButton,search,...buttons],current=focusable.indexOf(doc.activeElement);
        if(event.shiftKey&&current<=0){event.preventDefault();focusable.at(-1).focus()}
        else if(!event.shiftKey&&(current===focusable.length-1||current<0)){event.preventDefault();closeButton.focus()}
      }
    }
    function close(restoreFocus=true){
      if(!opened)return false;opened=false;shell.hidden=true;interruption.disconnect();doc.removeEventListener('keydown',keydown,true);
      for(const [element,wasInert] of background)element.inert=wasInert;background=[];
      if(!hadScrollLock)doc.body.classList.remove('profileCityViewing');
      config.onClose?.();if(restoreFocus&&origin?.isConnected)origin.focus({preventScroll:true});origin=null;return true;
    }
    function open(){
      if(opened||config.interrupted?.())return;origin=doc.activeElement;opened=true;search.value='';refreshLanguage();
      background=[...doc.body.children].filter(el=>el!==shell&&!['SCRIPT','STYLE','LINK'].includes(el.tagName)).map(el=>[el,el.inert===true]);
      for(const [element] of background)element.inert=true;
      hadScrollLock=doc.body.classList.contains('profileCityViewing');doc.body.classList.add('profileCityViewing');
      shell.hidden=false;doc.addEventListener('keydown',keydown,true);interruption.observe(doc.body,{childList:true});
      search.focus({preventScroll:true});config.onOpen?.();
    }
    function setValues(profile){
      close(false);
      for(const [id,key] of [['obAge','age'],['obCity','city'],['obGender','gender'],['obLooking','looking']]){
        const el=$(id);for(const item of el.querySelectorAll('option[data-legacy]'))item.remove();
        const value=String(profile?.[key]??'');if(value&&![...el.options].some(o=>o.value===value))option(el,value,value,true);el.value=value;
      }
      refreshLanguage();
    }
    cityButton.onclick=open;closeButton.onclick=()=>close();citySelect.addEventListener('change',updateCity);
    search.addEventListener('input',renderResults);shell.addEventListener('click',e=>{if(e.target===shell)close()});
    refreshLanguage();
    return {setValues,refreshLanguage,close,isOpen:()=>opened,destroy(){close(false);interruption.disconnect();shell.remove()}};
  }
  global.VybeProfileFields={create};
})(window);
