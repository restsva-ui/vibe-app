const TYPES: Record<string,{uk:string;en:string;ukText:string;enText:string}> = {
  spark:{uk:"Іскра",en:"Spark",ukText:"Тобі близькі флірт, грайливість і живі емоції.",enText:"You enjoy flirting, playfulness and lively emotions."},
  explorer:{uk:"Мандрівник",en:"Explorer",ukText:"Нові місця й маленькі пригоди зближують тебе з людьми.",enText:"New places and little adventures bring you closer to people."},
  cozy:{uk:"Затишок",en:"Cozy",ukText:"Цінуєш турботу, спокій і теплі моменти разом.",enText:"You value care, calm and warm moments together."},
  talker:{uk:"Співрозмовник",en:"Talker",ukText:"Твій вайб — цікаві розмови та уважність одне до одного.",enText:"Your vibe is thoughtful conversations and listening to each other."}
};
export function parseQuizStart(value: unknown){
  if(typeof value!=="string")return null;
  const m=value.trim().toLowerCase().match(/^qz_(spark|explorer|cozy|talker)(?:_(v[0-9a-z]{1,14}))?$/);
  return m?{type:m[1],referral:m[2]||null}:null;
}
export async function prepareQuizShare(body:Record<string,unknown>,ctx:{telegramId:number;telegram:(method:string,payload:Record<string,unknown>)=>Promise<any>}){
  if(typeof body.type!=="string"||!Object.hasOwn(TYPES,body.type)||!["uk","en"].includes(String(body.language))||typeof body.native!=="boolean")return {status:400,data:{ok:false,error:"INVALID_QUIZ_RESULT"}};
  if(!Number.isSafeInteger(ctx.telegramId)||ctx.telegramId<=0)return {status:400,data:{ok:false,error:"INVALID_QUIZ_USER"}};
  const type=body.type,lang=body.language==="en"?"en":"uk",info=TYPES[type];
  const code="v"+BigInt(ctx.telegramId).toString(36),start="qz_"+type+"_"+code;
  const url="https://t.me/vybe_now_bot?start="+start;
  const photoUrl="https://restsva-ui.github.io/vibe-app/assets/vybe-quiz-"+type+"-"+lang+".jpg?v=20261011-quiz1";
  const text=lang==="en"?`My vibe is ${info.en}. What's yours?\n5 questions in VYBE · For adults 18+.`:`Мій вайб — ${info.uk}. А твій?\n5 запитань у VYBE · Для дорослих 18+.`;
  let preparedId:string|null=null;
  if(body.native){
    try{
      const prepared=await ctx.telegram("savePreparedInlineMessage",{
        user_id:ctx.telegramId,allow_user_chats:true,allow_group_chats:true,allow_channel_chats:true,
        result:{type:"photo",id:crypto.randomUUID(),photo_url:photoUrl,thumbnail_url:photoUrl,photo_width:900,photo_height:1200,title:info[lang],caption:text,
          reply_markup:{inline_keyboard:[[{text:lang==="en"?"Discover my vibe ✨":"Дізнатися свій вайб ✨",url}]]}}
      });
      if(typeof prepared?.id==="string")preparedId=prepared.id;
    }catch{/* Explicit link sharing stays available when native preparation is unsupported. */}
  }
  return {status:200,data:{ok:true,url,text,photo_url:photoUrl,prepared_id:preparedId}};
}
