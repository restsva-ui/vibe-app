/* Full-screen profile photos. Keep the underlying profile and its scroll position. */
(function(global){
  'use strict';
  function create(config={}){
    const doc=global.document;
    const root=doc.createElement('div');
    root.id='vybePhotoViewer';root.className='photoShell photoViewer';root.hidden=true;
    root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');
    root.setAttribute('aria-labelledby','photoViewerName');
    root.innerHTML='<div class="photoViewerStage"></div><header class="photoViewerHeader"><h2 id="photoViewerName" class="userNameNoI18n"></h2><button id="photoViewerClose" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header><p class="photoViewerStatus" role="status"></p>';
    doc.body.append(root);
    const stage=root.querySelector('.photoViewerStage'),title=root.querySelector('h2');
    const button=root.querySelector('button'),status=root.querySelector('[role="status"]');
    let opened=false,origin=null,image=null,generation=0,background=[],hadScrollLock=false;
    const text=(uk,en)=>config.language?.()==='en'?en:uk;
    const interruption=new global.MutationObserver(()=>{if(opened&&config.interrupted?.())close(false)});
    function keydown(event){
      if(!opened)return;
      if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close()}
      else if(event.key==='Tab'){event.preventDefault();button.focus()}
    }
    function close(restoreFocus=true){
      if(!opened)return false;
      opened=false;generation++;interruption.disconnect();
      doc.removeEventListener('keydown',keydown,true);
      root.hidden=true;
      if(image){image.onload=null;image.onerror=null;image.removeAttribute('src');image=null}
      stage.replaceChildren();title.textContent='';status.textContent='';
      for(const [element,wasInert] of background)element.inert=wasInert;
      background=[];
      if(!hadScrollLock)doc.body.classList.remove('photoViewing');
      config.onClose?.();
      if(restoreFocus&&origin?.isConnected)origin.focus({preventScroll:true});
      origin=null;
      return true;
    }
    function open(value,name=''){
      let url;
      try{url=new URL(String(value||''),doc.baseURI)}catch{return false}
      if(!value||url.username||url.password||!(['https:','http:'].includes(url.protocol))||
        (url.protocol==='http:'&&url.origin!==new URL(doc.baseURI).origin)||config.interrupted?.())return false;
      const previousOrigin=opened?origin:doc.activeElement;
      if(opened)close(false);
      origin=previousOrigin;opened=true;const token=++generation;
      title.textContent=String(name||text('Фото профілю','Profile photo'));
      button.setAttribute('aria-label',text('Закрити фото','Close photo'));
      status.textContent=text('Завантаження фото…','Loading photo…');status.hidden=false;
      image=doc.createElement('img');image.alt=String(name||text('Фото профілю','Profile photo'));image.hidden=true;
      const current=image;
      current.onload=()=>{if(opened&&token===generation){current.hidden=false;status.hidden=true}};
      current.onerror=()=>{if(opened&&token===generation){status.hidden=false;status.textContent=text('Не вдалося завантажити фото. Закрий перегляд і спробуй ще раз.','Could not load the photo. Close the viewer and try again.')}};
      stage.replaceChildren(current);current.src=url.href;
      background=[...doc.body.children].filter(el=>el!==root&&!['SCRIPT','STYLE','LINK'].includes(el.tagName)).map(el=>[el,el.inert===true]);
      for(const [element] of background)element.inert=true;
      hadScrollLock=doc.body.classList.contains('photoViewing');doc.body.classList.add('photoViewing');
      root.hidden=false;doc.addEventListener('keydown',keydown,true);
      interruption.observe(doc.body,{childList:true});
      button.focus({preventScroll:true});config.onOpen?.();
      return true;
    }
    button.onclick=()=>close();
    return {open,close,isOpen:()=>opened,destroy(){close(false);interruption.disconnect();root.remove()}};
  }
  global.VybePhoto={create};
})(window);
