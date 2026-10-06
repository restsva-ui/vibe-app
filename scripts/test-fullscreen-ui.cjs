/* Modal lifecycle and map navigation checks without live accounts or network requests. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require(path.join(path.resolve(process.argv[2]||'/tmp/vybe-fullscreen-test'),'node_modules/jsdom'));
const photoSource=fs.readFileSync(path.join(__dirname,'../photo-viewer.js'),'utf8');
const mapSource=fs.readFileSync(path.join(__dirname,'../interests-map.js'),'utf8');
let checks=0;
async function check(name,fn){await fn();checks++;console.log('PASS:',name)}
const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve()};
async function main(){
  const dom=new JSDOM('<body><main><button id="trigger">Photo</button></main><div id="sheet"><b>Existing profile</b></div><aside id="alreadyInert"></aside></body>',{url:'https://ui.test/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,d=w.document;w.eval(photoSource);
  let lang='uk',opened=0,closed=0;
  const trigger=d.getElementById('trigger'),sheet=d.getElementById('sheet'),held=d.getElementById('alreadyInert');
  held.inert=true;sheet.scrollTop=123;
  const viewer=w.VybePhoto.create({language:()=>lang,interrupted:()=>!!d.getElementById('vybeCall'),onOpen:()=>opened++,onClose:()=>closed++});
  const root=d.getElementById('vybePhotoViewer'),closeButton=d.getElementById('photoViewerClose');
  await check('unsupported or credential-bearing photo URLs never open a modal',()=>{
    for(const url of ['',null,'javascript:alert(1)','data:text/html,test','http://external.test/photo.jpg','https://user:password@ui.test/photo.jpg'])assert.equal(viewer.open(url),false);
    assert.equal(root.hidden,true);
  });
  await check('opening a photo isolates the background and renders names as text',()=>{
    trigger.focus();assert.equal(viewer.open('/photo.jpg','<img src=x onerror=alert(1)>'),true);
    assert.equal(d.querySelector('main').inert,true);assert.equal(sheet.inert,true);
    assert.equal(d.activeElement,closeButton);assert.equal(root.querySelectorAll('img').length,1);
    assert.equal(root.querySelector('h2').textContent,'<img src=x onerror=alert(1)>');
  });
  await check('Tab stays in the modal instead of moving to the underlying profile',()=>{
    const event=new w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true});
    d.dispatchEvent(event);assert.equal(event.defaultPrevented,true);assert.equal(d.activeElement,closeButton);
  });
  await check('successful image loading reveals the complete image and clears loading status',()=>{
    const img=root.querySelector('img');img.dispatchEvent(new w.Event('load'));
    assert.equal(img.hidden,false);assert.equal(root.querySelector('[role="status"]').hidden,true);
  });
  await check('closing restores focus, existing inert states, profile content and scroll',()=>{
    closeButton.click();assert.equal(viewer.isOpen(),false);assert.equal(d.activeElement,trigger);
    assert.equal(sheet.inert,false);assert.equal(held.inert,true);assert.equal(sheet.scrollTop,123);
    assert.equal(sheet.innerHTML,'<b>Existing profile</b>');assert.equal(root.querySelector('img'),null);
    assert.equal(d.body.classList.contains('photoViewing'),false);assert.equal(opened,closed);
  });
  await check('failed photos remain closable with Escape',()=>{
    viewer.open('/missing.jpg','Photo');root.querySelector('img').dispatchEvent(new w.Event('error'));
    assert.match(root.querySelector('[role="status"]').textContent,/Не вдалося/);
    d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(viewer.isOpen(),false);
  });
  await check('late loading callbacks cannot reveal a different photo after reopening',()=>{
    viewer.open('/one.jpg');const stale=root.querySelector('img').onload;
    viewer.open('/two.jpg');stale();assert.equal(root.querySelector('img').hidden,true);
    viewer.close();assert.equal(d.activeElement,trigger);
  });
  await check('incoming calls dismiss photos and block reopening over call controls',async()=>{
    viewer.open('/photo.jpg');const call=d.createElement('div');call.id='vybeCall';d.body.append(call);await flush();
    assert.equal(viewer.isOpen(),false);assert.equal(sheet.inert,false);assert.equal(viewer.open('/photo.jpg'),false);call.remove();
  });
  await check('English labels preserve the original profile name',()=>{
    lang='en';viewer.open('/photo.jpg','Софія');assert.equal(closeButton.getAttribute('aria-label'),'Close photo');
    assert.equal(root.querySelector('h2').textContent,'Софія');assert.equal(root.querySelector('[role="status"]').textContent,'Loading photo…');viewer.close();
  });
  await check('destroy removes the modal and releases keyboard interception',()=>{
    viewer.open('/photo.jpg');viewer.destroy();assert.equal(d.getElementById('vybePhotoViewer'),null);
    const event=new w.KeyboardEvent('keydown',{key:'Escape',cancelable:true});d.dispatchEvent(event);assert.equal(event.defaultPrevented,false);
  });
  w.close();

  const mapDom=new JSDOM('<body><div id="sheetContent"></div></body>',{url:'https://map.test/',runScripts:'outside-only',pretendToBeVisual:true});
  const mw=mapDom.window,md=mw.document;
  mw.currentLang='uk';mw.uiText=x=>String(x);mw.escapeHtml=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  mw.uiIcon=()=>'<svg class="uiIcon" aria-hidden="true"></svg>';
  const fake={markers:[],maps:[],observers:0,tileEvents:{}};
  mw.ResizeObserver=class{constructor(){fake.observers++}observe(){}disconnect(){fake.observers--}};
  mw.L={
    map(){const m={center:[50.45,30.5],zoom:11,events:{},resizeCount:0,setView(center,zoom){this.center=center;this.zoom=zoom;return this},getCenter(){return {lat:this.center[0],lng:this.center[1]}},getZoom(){return this.zoom},getBounds(){return {getSouth:()=>49,getNorth:()=>51,getWest:()=>29,getEast:()=>32}},on(name,fn){this.events[name]=fn;return this},invalidateSize(){this.resizeCount++},remove(){this.removed=true},panTo(point){this.center=[point.lat,point.lng];this.events.moveend?.()}};fake.maps.push(m);return m},
    control:{zoom:()=>({addTo(){}})},
    tileLayer:()=>({addTo(){return this},on(name,fn){fake.tileEvents[name]=fn;return this}}),
    layerGroup:()=>({addTo(){return this},clearLayers(){fake.markers=[]}}),
    divIcon:x=>x,
    marker(point,options){const marker={point,options,events:{},addTo(){fake.markers.push(this);return this},on(name,fn){this.events[name]=fn;return this}};return marker},
    rectangle:()=>({addTo(){return this},remove(){}})
  };
  mw.eval(mapSource);
  const mountMarkup=picker=>{md.getElementById('sheetContent').innerHTML=mw.mapShellMarkup(picker)};
  const rows=[{user_id:'a',name:'Софія',age:28,map_lat:50.45,map_lng:30.5,interests:['coffee']},{user_id:'b',name:'<img src=x onerror=alert(1)>',map_lat:50.45,map_lng:30.5,interests:['music']},{user_id:'c',name:'Анна',map_lat:50.45,map_lng:30.55},{user_id:'expired',name:'Expired',map_lat:50.45,map_lng:30.5,expires_at:'2000-01-01'}];
  let selected=null,filterView=null;
  mountMarkup(false);
  const controller=await mw.mountVibeMap({loadPeople:async()=>({ok:true,people:rows}),onProfile:id=>selected=id,onFilter:view=>filterView=view,onCommon:()=>false});
  await check('map search starts collapsed and excludes expired profiles',()=>{
    assert.equal(md.getElementById('mapPeople').hidden,true);assert.equal(fake.markers.length,2);
    assert.match(md.getElementById('mapStatus').textContent,/: 3$/);assert.equal(md.querySelectorAll('.mapPerson').length,3);
    assert.equal(md.querySelector('#mapPeople img'),null);
  });
  await check('list toggle expands and collapses keyboard-accessible profile buttons',()=>{
    const toggle=md.getElementById('mapPeopleToggle');toggle.click();assert.equal(md.getElementById('mapPeople').hidden,false);assert.equal(toggle.getAttribute('aria-expanded'),'true');
    toggle.click();assert.equal(md.getElementById('mapPeople').hidden,true);assert.equal(toggle.getAttribute('aria-expanded'),'false');
  });
  await check('marker selection expands only its group and opens the selected profile',()=>{
    fake.markers[0].events.click();assert.equal(md.getElementById('mapPeople').hidden,false);assert.equal(md.querySelectorAll('.mapPerson').length,2);
    md.querySelector('[data-map-user="a"]').click();assert.equal(selected,'a');
  });
  await check('tile failures keep profile results and OpenStreetMap attribution available',()=>{
    const count=md.getElementById('mapStatus').textContent;fake.tileEvents.tileerror();
    assert.equal(md.getElementById('mapTileNotice').hidden,false);assert.equal(md.getElementById('mapStatus').textContent,count);
    assert.equal(md.querySelector('.mapProviderNotice a').href,'https://www.openstreetmap.org/copyright');assert.equal(md.querySelectorAll('.mapPerson').length,2);
  });
  await check('filters preserve the current map view and rejected interest filters revert',async()=>{
    md.getElementById('mapFilters').click();assert.equal(filterView.center.join(','),'50.45,30.5');assert.equal(filterView.zoom,11);
    const checkbox=md.getElementById('mapCommonOnly');checkbox.checked=true;checkbox.dispatchEvent(new mw.Event('change'));await flush();assert.equal(checkbox.checked,false);
  });
  await check('resizing updates Leaflet and closing releases layout observers',()=>{
    const map=fake.maps.at(-1),before=map.resizeCount;mw.dispatchEvent(new mw.Event('resize'));assert.ok(map.resizeCount>before);
    controller.destroy();assert.equal(map.removed,true);assert.equal(fake.observers,0);
    const after=map.resizeCount;mw.dispatchEvent(new mw.Event('resize'));assert.equal(map.resizeCount,after);
  });
  await check('closing during a pending map request prevents late DOM updates and observers',async()=>{
    mountMarkup(false);let resolve;const pending=new Promise(r=>resolve=r);let early;
    const mounted=mw.mountVibeMap({loadPeople:()=>pending,onProfile:()=>{},onFilter:()=>{},onCommon:()=>true,onReady:c=>early=c});
    await flush();early.destroy();resolve({ok:true,people:rows});await mounted;
    assert.equal(md.querySelectorAll('.mapPerson').length,0);assert.equal(fake.observers,0);
  });
  await check('network errors stop loading and remain visible to the user',async()=>{
    mountMarkup(false);const c=await mw.mountVibeMap({loadPeople:async()=>{throw Error('offline')},onProfile:()=>{},onFilter:()=>{},onCommon:()=>true});
    assert.match(md.getElementById('mapStatus').textContent,/Не вдалося/);assert.equal(md.getElementById('mapLoadState').classList.contains('hidden'),true);c.destroy();
  });
  await check('area confirmation retains the existing coarse location privacy boundary',async()=>{
    mountMarkup(true);let point;const c=await mw.mountVibeMap({picker:true,center:[50.473,30.527],onPick:x=>point=x});
    md.getElementById('confirmMapArea').click();assert.equal(point.lat,50.45);assert.equal(point.lng,30.55);
    assert.equal(md.getElementById('mapPeopleToggle'),null);assert.ok(md.querySelector('.mapCrosshair'));c.destroy();
  });
  mapDom.window.close();console.log('Fullscreen UI checks passed:',checks);
}
main().catch(error=>{console.error(error);process.exit(1)});
