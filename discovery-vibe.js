/* Collapse completed vibe choices without changing their state or search filters. */
(()=>{
  "use strict";
  const controls=document.getElementById("vibeControls");
  const summary=document.getElementById("vibeSummary");
  const nowCard=controls?.querySelector(".nowCard");
  const moods=controls?.querySelector(".moodStrip");
  const label=document.getElementById("compactVibeLabel");
  const searchLabel=document.getElementById("compactSearchLabel");
  const hint=document.getElementById("compactVibeHint");
  if(!controls||!summary||!nowCard||!moods||!label||!searchLabel||!hint)return;
  let previousActive=null,previousVibe="",previousLanguage="";
  const setText=(element,value)=>{if(element.textContent!==value)element.textContent=value};
  const expand=enabled=>{
    const focused=document.activeElement;
    const restoreFocus=!enabled&&focused!==summary&&controls.contains(focused);
    controls.open=enabled;
    if(restoreFocus)summary.focus({preventScroll:true});
  };
  const sync=()=>{
    const active=nowCard.classList.contains("isActive");
    const vibe=document.getElementById("nowLabel")?.textContent.trim()||"";
    const language=document.documentElement.lang;
    const en=language==="en";
    const selected=moods.querySelector(".mood.active");
    const selectedText=selected?.textContent.trim()||"";
    setText(label,vibe);
    setText(hint,document.getElementById("setNow")?.textContent.trim()||"");
    const showSearch=!!selected&&selectedText!==vibe&&(active||selected.dataset.mood!=="Усе");
    searchLabel.hidden=!showSearch;
    setText(searchLabel,showSearch?(en?"Search: ":"Пошук: ")+selectedText:"");
    summary.setAttribute("aria-label",(en?"Vibe and search: ":"Вайб і пошук: ")+vibe+(showSearch?". "+searchLabel.textContent:""));
    const newVibe=active&&(!previousActive||(language===previousLanguage&&vibe!==previousVibe));
    const expired=previousActive===true&&!active;
    if(previousActive===null||newVibe||expired)expand(!active);
    previousActive=active;
    previousVibe=vibe;
    previousLanguage=language;
  };
  const observer=new MutationObserver(sync);
  observer.observe(nowCard,{attributes:true,attributeFilter:["class"],childList:true,subtree:true,characterData:true});
  observer.observe(moods,{attributes:true,attributeFilter:["class"],childList:true,subtree:true,characterData:true});
  observer.observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});
  controls.addEventListener("click",event=>{
    const mood=event.target.closest?.(".mood");
    if(mood&&moods.contains(mood)){expand(false);sync()}
  });
  document.addEventListener("click",event=>{
    if(event.target.closest?.("#saveNow")&&document.querySelector("#sheetContent .choice[data-intent].selected"))expand(false);
  });
  sync();
})();
