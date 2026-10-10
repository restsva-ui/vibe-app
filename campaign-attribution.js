(function(root){
  "use strict";
  const WINDOW_MS=7*24*60*60*1000;
  function parseStart(value){
    if(typeof value!=="string")return null;
    const match=value.trim().toLowerCase().match(/^tt_([a-z0-9][a-z0-9_]{0,60})$/);
    return match?match[1]:null;
  }
  function fromLaunch(href,telegram){
    let query=new URLSearchParams();
    try{query=new URL(href).searchParams}catch{}
    const signedParams=new URLSearchParams(telegram?.initData||"");
    for(const value of [signedParams.get("start_param"),telegram?.initDataUnsafe?.start_param,
      query.get("tgWebAppStartParam"),query.get("start_param"),query.get("campaign")]){
      const campaign=parseStart(value);if(campaign)return campaign;
    }
    return null;
  }
  function accountKey(userId){
    return typeof userId==="string"&&/^[a-z0-9_-]{1,80}$/i.test(userId)?"vybeCampaign:"+userId:null;
  }
  function getStorage(storage){try{return storage||root.localStorage}catch{return null}}
  function clear(userId,storage){
    const key=accountKey(userId);if(!key)return;
    try{getStorage(storage)?.removeItem(key)}catch{}
  }
  function forAccount(userId,launch,{storage,enabled=true,now=Date.now()}={}){
    const key=accountKey(userId);if(!key||!Number.isFinite(now))return null;
    if(!enabled){clear(userId,storage);return null}
    let previous=null;
    try{previous=JSON.parse(getStorage(storage)?.getItem(key)||"null")}catch{}
    if(!previous||parseStart("tt_"+previous.id)!==previous.id||!Number.isFinite(previous.at)||
      previous.at>now||now-previous.at>=WINDOW_MS)previous=null;
    const id=typeof launch==="string"?parseStart("tt_"+launch):null;
    if(!id)return previous;
    const current={id,at:now};
    try{getStorage(storage)?.setItem(key,JSON.stringify(current))}catch{}
    return current;
  }
  function properties(campaign){
    if(!campaign||parseStart("tt_"+campaign.id)!==campaign.id)return {};
    return {campaign_source:"tiktok",campaign_id:campaign.id,
      utm_source:"tiktok",utm_medium:"organic_social",utm_campaign:campaign.id};
  }
  const api={parseStart,fromLaunch,forAccount,properties,clear};
  root.VybeCampaign=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
