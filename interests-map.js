/* Shared interests and an opt-in, manually chosen area. No device geolocation. */
const VYBE_INTERESTS=Object.freeze([
  ["travel","Подорожі","Travel","✈️"],["music","Музика","Music","🎵"],
  ["cinema","Кіно","Cinema","🎬"],["gaming","Ігри","Gaming","🎮"],
  ["books","Книги","Books","📚"],["sport","Спорт","Sport","🏃"],
  ["outdoors","Прогулянки","Walks","🌿"],["coffee","Кава","Coffee","☕"],
  ["food","Їжа","Food","🍜"],["cooking","Кулінарія","Cooking","🍳"],
  ["art","Мистецтво","Art","🎨"],["tech","Технології","Technology","💻"],
  ["languages","Мови","Languages","🌍"],["pets","Тварини","Pets","🐾"],
  ["dancing","Танці","Dancing","💃"],["photography","Фото","Photography","📷"]
]);
const VYBE_INTEREST_IDS=new Set(VYBE_INTERESTS.map(x=>x[0]));
function normalizeInterests(values){return Array.isArray(values)?[...new Set(values.filter(x=>typeof x==="string"&&VYBE_INTEREST_IDS.has(x)))].slice(0,8):[]}
function interestLabel(id){const item=VYBE_INTERESTS.find(x=>x[0]===id);return item?item[3]+" "+item[currentLang==="en"?2:1]:""}
function interestTags(values,common=[],limit=8){
  const shared=new Set(normalizeInterests(common));
  return normalizeInterests(values).slice(0,limit).map(id=>'<span class="interestTag '+(shared.has(id)?'commonInterest':'')+'">'+escapeHtml(interestLabel(id))+'</span>').join("");
}
function interestPickerMarkup(id,values=[]){
  const selected=new Set(normalizeInterests(values));
  return '<div id="'+id+'" class="interestPicker" role="group" aria-label="'+uiText("Інтереси")+'">'+VYBE_INTERESTS.map(x=>'<button type="button" class="interestChoice '+(selected.has(x[0])?'selected':'')+'" data-interest="'+x[0]+'" aria-pressed="'+selected.has(x[0])+'">'+escapeHtml(interestLabel(x[0]))+'</button>').join("")+'</div>';
}
function bindInterestPicker(id,values=[],onChange=()=>{}){
  const selected=new Set(normalizeInterests(values));
  const root=document.getElementById(id);
  root?.querySelectorAll("[data-interest]").forEach(button=>button.onclick=()=>{
    const key=button.dataset.interest;
    if(selected.has(key))selected.delete(key);
    else if(selected.size<8)selected.add(key);
    else{showAlert("Можна обрати до 8 інтересів.");return}
    button.classList.toggle("selected",selected.has(key));
    button.setAttribute("aria-pressed",String(selected.has(key)));
    onChange([...selected]);
  });
  return ()=>[...selected];
}
function snapMapPoint(lat,lng){
  if(typeof lat!=="number"||typeof lng!=="number"||!Number.isFinite(lat)||!Number.isFinite(lng)||lat< -85||lat>85||lng< -180||lng>180)return null;
  return {lat:Number((Math.round(lat*20)/20).toFixed(2)),lng:Number((Math.round(lng*20)/20).toFixed(2))};
}
const VYBE_MAP_CITIES=[
  ["Київ","Kyiv",50.45,30.5],["Львів","Lviv",49.85,24.05],
  ["Одеса","Odesa",46.5,30.7],["Харків","Kharkiv",50,36.25],
  ["Дніпро","Dnipro",48.45,35.05],["Запоріжжя","Zaporizhzhia",47.85,35.15],
  ["Вінниця","Vinnytsia",49.25,28.45],["Івано-Франківськ","Ivano-Frankivsk",48.9,24.7],
  ["Тернопіль","Ternopil",49.55,25.6],["Чернівці","Chernivtsi",48.3,25.95],
  ["Ужгород","Uzhhorod",48.6,22.3],["Полтава","Poltava",49.6,34.55]
];
function mapCityCenter(city){const name=String(city||"").trim().toLowerCase();const found=VYBE_MAP_CITIES.find(x=>x[0].toLowerCase()===name||x[1].toLowerCase()===name);return found?[found[2],found[3]]:[50.45,30.5]}
let leafletPromise=null;
function loadLeaflet(){
  if(window.L)return Promise.resolve(window.L);
  if(leafletPromise)return leafletPromise;
  const stylesheet=document.createElement("link");stylesheet.rel="stylesheet";stylesheet.href="./vendor/leaflet/leaflet.css";document.head.appendChild(stylesheet);
  leafletPromise=new Promise((resolve,reject)=>{
    const script=document.createElement("script");script.src="./vendor/leaflet/leaflet.js";
    script.onload=()=>window.L?resolve(window.L):reject(new Error("map_library_unavailable"));
    script.onerror=()=>{leafletPromise=null;script.remove();reject(new Error("map_library_unavailable"))};
    document.head.appendChild(script);
  });
  return leafletPromise;
}
function mapCityOptions(){return VYBE_MAP_CITIES.map((city,i)=>'<option value="'+i+'">'+escapeHtml(city[currentLang==="en"?1:0])+'</option>').join("")}
function mapShellMarkup(picker=false){
  const privacy=uiText(picker?"Наведи карту на район. Інші бачитимуть лише приблизну ділянку в кілька кілометрів.":"Приблизні позначки · активний VYBE NOW");
  const tools='<div class="mapTopPanel"><h2>'+uiText(picker?"Обери свій район":"Люди на карті")+'</h2><p class="mapPrivacy">'+privacy+'</p><div class="mapToolbar"><label class="srOnly" for="mapCity">'+uiText("Місто на карті")+'</label><select id="mapCity" class="field"><option value="">'+uiText("Перейти до міста")+'</option>'+mapCityOptions()+'</select>'+(picker?'':'<button id="mapFilters" type="button" class="choice">'+uiText("Фільтри")+'</button>')+'</div>'+(picker?'':'<label class="checkRow mapCommon"><input id="mapCommonOnly" type="checkbox"><span>'+uiText("Лише зі спільними інтересами")+'</span></label>')+'</div>';
  const results=picker?'<div id="mapStatus" class="mapStatus" role="status"></div><button id="confirmMapArea" type="button" class="primary" disabled>'+uiText("Обрати цей район")+'</button>':'<button id="mapPeopleToggle" type="button" class="mapPeopleToggle" aria-expanded="false" aria-controls="mapPeople"><span><b id="mapListLabel">'+uiText("Показати анкети")+'</b><span id="mapStatus" class="mapStatus" role="status">'+uiText("Завантаження…")+'</span></span>'+uiIcon("chevron")+'</button><div id="mapPeople" class="mapPeople" hidden></div>';
  const credit='<small class="mapProviderNotice"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a><span>'+uiText("OpenStreetMap отримує IP-адресу та ділянку карти, яку ти переглядаєш.")+'</span></small>';
  const modes=picker?'':'<div class="planModes"><button type="button" class="selected" aria-current="page">'+(currentLang==='en'?'People':'Люди')+'</button><button id="mapPlans" type="button">'+(currentLang==='en'?'Plans':'Плани')+'</button></div>';
  return '<div class="mapShell'+(picker?' mapPicker':'')+'"><div class="mapCanvasWrap"><div id="peopleMap" class="mapCanvas" role="region" aria-label="'+uiText("Карта")+'"></div>'+(picker?'<div class="mapCrosshair" aria-hidden="true">'+uiIcon("location")+'</div>':'')+'<div id="mapLoadState" class="mapLoadState" role="status">'+uiText("Завантаження…")+'</div></div>'+tools.replace('<h2>',modes+'<h2>')+'<div class="mapFooter'+(picker?' mapPickerFooter':'')+'">'+results+'<p id="mapTileNotice" class="mapTileNotice" role="status" hidden></p>'+credit+'</div></div>';
}
async function mountVibeMap({picker=false,center=[50.45,30.5],zoom=11,loadPeople,onProfile,onPick,onFilter,commonOnly=false,onCommon,onReady=()=>{}}){
  const target=document.getElementById("peopleMap"),shell=target?.closest('.mapShell');
  const find=id=>shell?.querySelector('#'+id);
  let closed=false,map=null,timer=null,interval=null,generation=0,layoutObserver=null;
  const updateLayout=()=>{
    if(closed||!target?.isConnected||!map)return;
    const height=shell.querySelector('.mapFooter')?.getBoundingClientRect().height||110;
    shell.style.setProperty('--map-footer-height',height+'px');
    map.invalidateSize({pan:false});
  };
  const controller={
    destroy(){closed=true;generation++;clearTimeout(timer);clearInterval(interval);layoutObserver?.disconnect();window.removeEventListener('resize',updateLayout);map?.remove();map=null;},
    view(){return map?{center:[map.getCenter().lat,map.getCenter().lng],zoom:map.getZoom()}:null}
  };
  onReady(controller);
  try{
    const L=await loadLeaflet();
    if(closed||!target?.isConnected)return controller;
    map=L.map(target,{minZoom:3,maxZoom:15,maxBounds:[[-85,-180],[85,180]],maxBoundsViscosity:1,zoomControl:false,attributionControl:false}).setView(center,zoom);
    L.control.zoom({position:"bottomleft",zoomInTitle:uiText("Наблизити"),zoomOutTitle:uiText("Віддалити")}).addTo(map);
    const tiles=L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'}).addTo(map);
    tiles.on("tileerror",()=>{
      if(closed||!target.isConnected)return;
      const notice=find('mapTileNotice');notice.hidden=false;notice.textContent=uiText("Підкладка карти недоступна. Анкети можна відкрити зі списку.");updateLayout();
    });
    find("mapLoadState").classList.add("hidden");
    find("mapCity").onchange=e=>{const city=VYBE_MAP_CITIES[Number(e.target.value)];if(e.target.value!==""&&city)map.setView([city[2],city[3]],11)};
    if(picker){
      let area;
      const showArea=()=>{const c=map.getCenter(),point=snapMapPoint(c.lat,c.lng);if(!point)return;area?.remove();area=L.rectangle([[point.lat-.025,point.lng-.025],[point.lat+.025,point.lng+.025]],{color:getComputedStyle(document.documentElement).getPropertyValue("--accent").trim()||"#dce1e8",weight:2,fillOpacity:.18,interactive:false}).addTo(map);};
      showArea();map.on("moveend",showArea);map.on("click",e=>map.panTo(e.latlng));
      const button=find("confirmMapArea");button.disabled=false;button.onclick=()=>{const c=map.getCenter();onPick(snapMapPoint(c.lat,c.lng));};
      find("mapStatus").textContent=uiText("Виділена ділянка — район, який побачать інші.");
    }else{
      const layers=L.layerGroup().addTo(map),peopleElement=find("mapPeople"),toggle=find('mapPeopleToggle');
      const setExpanded=expanded=>{toggle.setAttribute('aria-expanded',String(expanded));peopleElement.hidden=!expanded;find('mapListLabel').textContent=uiText(expanded?'Згорнути список':'Показати анкети');updateLayout()};
      toggle.onclick=()=>setExpanded(peopleElement.hidden);
      const display=rows=>{
        peopleElement.innerHTML=rows.length?rows.map(p=>'<button type="button" class="mapPerson" data-map-user="'+escapeHtml(p.user_id)+'"><span class="mapPersonInitial userNameNoI18n">'+escapeHtml(String(p.name||"V").charAt(0))+'</span><span><b class="userNameNoI18n">'+escapeHtml(p.name)+(p.age?", "+escapeHtml(p.age):"")+'</b><small>'+escapeHtml(p.city||"")+(p.common_interests?.length?' · '+uiText("Спільні інтереси: ")+p.common_interests.length:"")+'</small><span class="mapInterestTags">'+interestTags(p.interests,p.common_interests,3)+'</span></span>'+uiIcon("chevron")+'</button>').join(""):'<div class="mapEmpty">'+uiText("У цій ділянці поки немає активних анкет. Зміни район або фільтри.")+'</div>';
        peopleElement.querySelectorAll("[data-map-user]").forEach(b=>b.onclick=()=>onProfile(b.dataset.mapUser));
      };
      const refresh=async()=>{
        if(closed||!target.isConnected||!map)return;
        const current=++generation,b=map.getBounds();
        const bounds={south:Math.max(-85,b.getSouth()),north:Math.min(85,b.getNorth()),west:Math.max(-180,b.getWest()),east:Math.min(180,b.getEast())};
        find("mapLoadState").classList.remove("hidden");
        let response;
        try{response=await loadPeople(bounds)}catch{response={ok:false}}
        if(closed||!target.isConnected||current!==generation)return;
        find("mapLoadState").classList.add("hidden");
        if(!response?.ok){find("mapStatus").textContent=uiText("Не вдалося завантажити карту людей. Спробуй ще раз.");return;}
        layers.clearLayers();
        const rows=(response.people||[]).filter(p=>p.map_lat!=null&&p.map_lng!=null&&(!p.expires_at||new Date(p.expires_at).getTime()>Date.now()));
        const groups=new Map();for(const p of rows){const key=p.map_lat+":"+p.map_lng;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p)}
        for(const group of groups.values()){
          const p=group[0],label=group.map(x=>x.name).join(", ");
          const icon=L.divIcon({className:"peoplePin",html:'<span>'+escapeHtml(group.length>1?String(group.length):String(p.name||"V").charAt(0))+'</span>',iconSize:[42,42],iconAnchor:[21,21]});
          L.marker([Number(p.map_lat),Number(p.map_lng)],{icon,title:label,alt:label,keyboard:true}).addTo(layers).on("click",()=>{display(group);setExpanded(true)});
        }
        display(rows);
        find("mapStatus").textContent=response.has_more?uiText("Показано до 100 анкет. Наблизь карту для точнішого пошуку."):uiText("Анкет у цій ділянці: ")+rows.length;
        updateLayout();
      };
      const common=find("mapCommonOnly");common.checked=commonOnly;common.onchange=()=>{if(onCommon(common.checked)===false)common.checked=false;void refresh()};
      find("mapFilters").onclick=()=>onFilter(controller.view());
      map.on("moveend",()=>{clearTimeout(timer);timer=setTimeout(refresh,450)});
      interval=setInterval(refresh,60000);await refresh();
    }
    if(closed||!target.isConnected)return controller;
    if(window.ResizeObserver){layoutObserver=new ResizeObserver(updateLayout);layoutObserver.observe(target);layoutObserver.observe(shell.querySelector('.mapFooter'))}
    window.addEventListener('resize',updateLayout);
    requestAnimationFrame(updateLayout);
  }catch(error){if(target?.isConnected&&!closed){find("mapLoadState").textContent=uiText("Не вдалося відкрити карту. Перевір з’єднання й спробуй ще раз.");}}
  return controller;
}
