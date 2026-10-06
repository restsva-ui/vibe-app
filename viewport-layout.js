/* Measure the visible footer rather than assuming fixed label or Telegram inset sizes. */
(()=>{
  "use strict";
  const root=document.documentElement,footer=document.querySelector(".appFooter"),view=document.getElementById("discoverView"),stack=document.getElementById("cardStack");
  if(!footer||!view||!stack)return;
  let frame=0;
  const setPixels=(name,value)=>{
    const next=Math.round(value)+"px";
    if(root.style.getPropertyValue(name)!==next)root.style.setProperty(name,next);
  };
  const measure=()=>{
    frame=0;
    const height=window.innerHeight||root.clientHeight;
    const footerTop=footer.getBoundingClientRect().top;
    setPixels("--app-footer-space",Math.max(0,height-footerTop)+12);
    const card=stack.querySelector(".personCard");
    if(!view.classList.contains("active")||!card)return;
    const metadata=card.querySelector(".personMeta");
    const minimum=Math.max(180,(metadata?.getBoundingClientRect().height||0)+32);
    const stackTop=stack.getBoundingClientRect().top+window.scrollY;
    setPixels("--discovery-card-height",Math.max(minimum,Math.min(540,footerTop-stackTop-12)));
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(measure)};
  if(window.ResizeObserver){
    const observer=new ResizeObserver(schedule);
    [footer,document.querySelector(".topbar"),document.getElementById("vibeControls"),document.querySelector(".nowCard"),document.querySelector(".moodStrip"),view.querySelector(".sectionTitle")].filter(Boolean).forEach(el=>observer.observe(el));
  }
  const changes=new MutationObserver(schedule);
  changes.observe(view,{attributes:true,attributeFilter:["class"]});
  changes.observe(stack,{childList:true,subtree:true});
  const actions=document.getElementById("discoverActions");
  if(actions)changes.observe(actions,{attributes:true,attributeFilter:["class"]});
  changes.observe(root,{attributes:true,attributeFilter:["lang"]});
  window.addEventListener("resize",schedule);
  window.visualViewport?.addEventListener("resize",schedule);
  document.addEventListener("animationend",event=>{if(event.target===view)schedule()});
  const telegram=window.Telegram?.WebApp;
  ["viewportChanged","safeAreaChanged","contentSafeAreaChanged"].forEach(name=>telegram?.onEvent?.(name,schedule));
  schedule();
})();
