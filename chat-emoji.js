/* VYBE emoji picker. Unicode artwork stays native; nothing is fetched or tracked. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.VybeEmoji=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const catalog=[
  {
    "emoji": "😊",
    "category": "faces",
    "uk": "Усмішка",
    "en": "Smile",
    "tags": "радість happy"
  },
  {
    "emoji": "😄",
    "category": "faces",
    "uk": "Радість",
    "en": "Joy",
    "tags": "сміх happy"
  },
  {
    "emoji": "😁",
    "category": "faces",
    "uk": "Широка усмішка",
    "en": "Big grin",
    "tags": "радість happy"
  },
  {
    "emoji": "😂",
    "category": "faces",
    "uk": "Сміх до сліз",
    "en": "Laughing tears",
    "tags": "сміх lol"
  },
  {
    "emoji": "🤣",
    "category": "faces",
    "uk": "Дуже смішно",
    "en": "Rolling laughter",
    "tags": "сміх lol"
  },
  {
    "emoji": "🥹",
    "category": "faces",
    "uk": "Зворушення",
    "en": "Moved",
    "tags": "сльози мило emotional"
  },
  {
    "emoji": "🥰",
    "category": "faces",
    "uk": "Закохана усмішка",
    "en": "Feeling loved",
    "tags": "любов love"
  },
  {
    "emoji": "😍",
    "category": "faces",
    "uk": "Захоплення",
    "en": "Heart eyes",
    "tags": "любов love"
  },
  {
    "emoji": "🤩",
    "category": "faces",
    "uk": "Вау",
    "en": "Star eyes",
    "tags": "захоплення wow"
  },
  {
    "emoji": "😉",
    "category": "faces",
    "uk": "Підморгування",
    "en": "Wink",
    "tags": "флірт flirt"
  },
  {
    "emoji": "😘",
    "category": "faces",
    "uk": "Повітряний поцілунок",
    "en": "Blowing a kiss",
    "tags": "любов kiss"
  },
  {
    "emoji": "😚",
    "category": "faces",
    "uk": "Ніжний поцілунок",
    "en": "Gentle kiss",
    "tags": "любов kiss"
  },
  {
    "emoji": "😏",
    "category": "faces",
    "uk": "Хитра усмішка",
    "en": "Smirk",
    "tags": "флірт flirt"
  },
  {
    "emoji": "😌",
    "category": "faces",
    "uk": "Спокій",
    "en": "Relieved",
    "tags": "затишок calm"
  },
  {
    "emoji": "🙂",
    "category": "faces",
    "uk": "Легка усмішка",
    "en": "Little smile",
    "tags": "привіт hello"
  },
  {
    "emoji": "🙃",
    "category": "faces",
    "uk": "Іронія",
    "en": "Upside down",
    "tags": "жарт irony"
  },
  {
    "emoji": "🫠",
    "category": "faces",
    "uk": "Тану",
    "en": "Melting",
    "tags": "спека сором melting"
  },
  {
    "emoji": "🤗",
    "category": "faces",
    "uk": "Обійми",
    "en": "Hug",
    "tags": "тепло hug hugs"
  },
  {
    "emoji": "🤭",
    "category": "faces",
    "uk": "Сором’язлива усмішка",
    "en": "Shy giggle",
    "tags": "сором shy"
  },
  {
    "emoji": "🫢",
    "category": "faces",
    "uk": "Ой",
    "en": "Gasp",
    "tags": "здивування surprise"
  },
  {
    "emoji": "🤫",
    "category": "faces",
    "uk": "Тихо",
    "en": "Shh",
    "tags": "секрет quiet"
  },
  {
    "emoji": "🤔",
    "category": "faces",
    "uk": "Думаю",
    "en": "Thinking",
    "tags": "питання think"
  },
  {
    "emoji": "😎",
    "category": "faces",
    "uk": "Круто",
    "en": "Cool",
    "tags": "сонце cool"
  },
  {
    "emoji": "🥳",
    "category": "faces",
    "uk": "Святкую",
    "en": "Party face",
    "tags": "свято party"
  },
  {
    "emoji": "😋",
    "category": "faces",
    "uk": "Смакота",
    "en": "Yummy",
    "tags": "їжа food"
  },
  {
    "emoji": "😜",
    "category": "faces",
    "uk": "Грайливість",
    "en": "Playful wink",
    "tags": "жарт fun"
  },
  {
    "emoji": "😇",
    "category": "faces",
    "uk": "Янгол",
    "en": "Angel",
    "tags": "милота innocent"
  },
  {
    "emoji": "🥺",
    "category": "faces",
    "uk": "Будь ласка",
    "en": "Pleading",
    "tags": "прохання please"
  },
  {
    "emoji": "😅",
    "category": "faces",
    "uk": "Незручно",
    "en": "Awkward laugh",
    "tags": "сором sweat"
  },
  {
    "emoji": "😮‍💨",
    "category": "faces",
    "uk": "Видих",
    "en": "Exhale",
    "tags": "полегшення relieved"
  },
  {
    "emoji": "😴",
    "category": "faces",
    "uk": "Сплю",
    "en": "Sleepy",
    "tags": "сон goodnight"
  },
  {
    "emoji": "😳",
    "category": "faces",
    "uk": "Ніяковію",
    "en": "Blushing",
    "tags": "сором shy"
  },
  {
    "emoji": "🥲",
    "category": "faces",
    "uk": "Усмішка крізь сльози",
    "en": "Smiling with tears",
    "tags": "сльози tears"
  },
  {
    "emoji": "😭",
    "category": "faces",
    "uk": "Плачу",
    "en": "Crying",
    "tags": "сум tears"
  },
  {
    "emoji": "😔",
    "category": "faces",
    "uk": "Сумую",
    "en": "Sad",
    "tags": "сум sad"
  },
  {
    "emoji": "😤",
    "category": "faces",
    "uk": "Обурення",
    "en": "Frustrated",
    "tags": "злість angry"
  },
  {
    "emoji": "🤯",
    "category": "faces",
    "uk": "Мозок вибухнув",
    "en": "Mind blown",
    "tags": "вау wow"
  },
  {
    "emoji": "🧐",
    "category": "faces",
    "uk": "Цікаво",
    "en": "Curious",
    "tags": "думки curious"
  },
  {
    "emoji": "🙈",
    "category": "faces",
    "uk": "Не можу дивитися",
    "en": "See no evil",
    "tags": "сором shy"
  },
  {
    "emoji": "🙉",
    "category": "faces",
    "uk": "Не чую",
    "en": "Hear no evil",
    "tags": "жарт monkey"
  },
  {
    "emoji": "🙊",
    "category": "faces",
    "uk": "Мовчу",
    "en": "Speak no evil",
    "tags": "секрет monkey"
  },
  {
    "emoji": "😈",
    "category": "faces",
    "uk": "Пустощі",
    "en": "Mischievous",
    "tags": "флірт devil"
  },
  {
    "emoji": "🌝",
    "category": "faces",
    "uk": "Місяць з усмішкою",
    "en": "Moon smile",
    "tags": "ніч moon"
  },
  {
    "emoji": "❤️",
    "category": "love",
    "uk": "Червоне серце",
    "en": "Red heart",
    "tags": "любов love"
  },
  {
    "emoji": "🧡",
    "category": "love",
    "uk": "Помаранчеве серце",
    "en": "Orange heart",
    "tags": "любов love"
  },
  {
    "emoji": "💛",
    "category": "love",
    "uk": "Жовте серце",
    "en": "Yellow heart",
    "tags": "любов love"
  },
  {
    "emoji": "💚",
    "category": "love",
    "uk": "Зелене серце",
    "en": "Green heart",
    "tags": "любов love"
  },
  {
    "emoji": "💙",
    "category": "love",
    "uk": "Синє серце",
    "en": "Blue heart",
    "tags": "любов love"
  },
  {
    "emoji": "💜",
    "category": "love",
    "uk": "Фіолетове серце",
    "en": "Purple heart",
    "tags": "любов love"
  },
  {
    "emoji": "🖤",
    "category": "love",
    "uk": "Чорне серце",
    "en": "Black heart",
    "tags": "любов love"
  },
  {
    "emoji": "🤍",
    "category": "love",
    "uk": "Біле серце",
    "en": "White heart",
    "tags": "любов love"
  },
  {
    "emoji": "🤎",
    "category": "love",
    "uk": "Коричневе серце",
    "en": "Brown heart",
    "tags": "любов love"
  },
  {
    "emoji": "💖",
    "category": "love",
    "uk": "Сяюче серце",
    "en": "Sparkling heart",
    "tags": "любов love"
  },
  {
    "emoji": "💕",
    "category": "love",
    "uk": "Два серця",
    "en": "Two hearts",
    "tags": "любов love"
  },
  {
    "emoji": "💞",
    "category": "love",
    "uk": "Серця разом",
    "en": "Revolving hearts",
    "tags": "любов love"
  },
  {
    "emoji": "💓",
    "category": "love",
    "uk": "Серце б’ється",
    "en": "Beating heart",
    "tags": "любов love"
  },
  {
    "emoji": "💗",
    "category": "love",
    "uk": "Зростаюче серце",
    "en": "Growing heart",
    "tags": "любов love"
  },
  {
    "emoji": "💘",
    "category": "love",
    "uk": "Стріла кохання",
    "en": "Heart with arrow",
    "tags": "любов love"
  },
  {
    "emoji": "💝",
    "category": "love",
    "uk": "Серце в подарунок",
    "en": "Heart gift",
    "tags": "любов gift"
  },
  {
    "emoji": "❤️‍🔥",
    "category": "love",
    "uk": "Палаюче серце",
    "en": "Heart on fire",
    "tags": "любов пристрасть passion"
  },
  {
    "emoji": "❤️‍🩹",
    "category": "love",
    "uk": "Загоєне серце",
    "en": "Healing heart",
    "tags": "підтримка healing"
  },
  {
    "emoji": "💔",
    "category": "love",
    "uk": "Розбите серце",
    "en": "Broken heart",
    "tags": "сум sad"
  },
  {
    "emoji": "🫶",
    "category": "love",
    "uk": "Серце руками",
    "en": "Heart hands",
    "tags": "любов підтримка support"
  },
  {
    "emoji": "💋",
    "category": "love",
    "uk": "Поцілунок",
    "en": "Kiss",
    "tags": "флірт kiss"
  },
  {
    "emoji": "💌",
    "category": "love",
    "uk": "Любовний лист",
    "en": "Love letter",
    "tags": "лист message"
  },
  {
    "emoji": "🌹",
    "category": "love",
    "uk": "Троянда",
    "en": "Rose",
    "tags": "квіти flower"
  },
  {
    "emoji": "💐",
    "category": "love",
    "uk": "Букет",
    "en": "Bouquet",
    "tags": "квіти flowers"
  },
  {
    "emoji": "🌷",
    "category": "love",
    "uk": "Тюльпан",
    "en": "Tulip",
    "tags": "квіти flower"
  },
  {
    "emoji": "🦋",
    "category": "love",
    "uk": "Метелик",
    "en": "Butterfly",
    "tags": "ніжність butterfly"
  },
  {
    "emoji": "🔥",
    "category": "love",
    "uk": "Вогонь",
    "en": "Fire",
    "tags": "флірт круто hot"
  },
  {
    "emoji": "✨",
    "category": "love",
    "uk": "Іскри",
    "en": "Sparkles",
    "tags": "вайб magic"
  },
  {
    "emoji": "👋",
    "category": "gestures",
    "uk": "Привіт",
    "en": "Wave",
    "tags": "вітання hello bye"
  },
  {
    "emoji": "🤝",
    "category": "gestures",
    "uk": "Домовились",
    "en": "Handshake",
    "tags": "угода agree"
  },
  {
    "emoji": "👍",
    "category": "gestures",
    "uk": "Подобається",
    "en": "Thumbs up",
    "tags": "так like yes"
  },
  {
    "emoji": "👎",
    "category": "gestures",
    "uk": "Не подобається",
    "en": "Thumbs down",
    "tags": "ні no"
  },
  {
    "emoji": "👌",
    "category": "gestures",
    "uk": "Чудово",
    "en": "OK hand",
    "tags": "добре okay"
  },
  {
    "emoji": "🤌",
    "category": "gestures",
    "uk": "Ідеально",
    "en": "Pinched fingers",
    "tags": "італія perfect"
  },
  {
    "emoji": "✌️",
    "category": "gestures",
    "uk": "Мир",
    "en": "Peace",
    "tags": "перемога victory"
  },
  {
    "emoji": "🤞",
    "category": "gestures",
    "uk": "Тримаю кулачки",
    "en": "Fingers crossed",
    "tags": "удача luck"
  },
  {
    "emoji": "🤟",
    "category": "gestures",
    "uk": "Люблю тебе",
    "en": "Love you gesture",
    "tags": "любов love"
  },
  {
    "emoji": "🤘",
    "category": "gestures",
    "uk": "Рок",
    "en": "Rock on",
    "tags": "музика rock"
  },
  {
    "emoji": "🫰",
    "category": "gestures",
    "uk": "Маленьке серце",
    "en": "Finger heart",
    "tags": "любов love"
  },
  {
    "emoji": "🙌",
    "category": "gestures",
    "uk": "Ура",
    "en": "Celebration hands",
    "tags": "свято hooray"
  },
  {
    "emoji": "👏",
    "category": "gestures",
    "uk": "Оплески",
    "en": "Applause",
    "tags": "браво clap"
  },
  {
    "emoji": "🙏",
    "category": "gestures",
    "uk": "Дякую",
    "en": "Thank you",
    "tags": "прохання prayer thanks"
  },
  {
    "emoji": "💪",
    "category": "gestures",
    "uk": "Сила",
    "en": "Strong",
    "tags": "підтримка спорт support"
  },
  {
    "emoji": "🫱",
    "category": "gestures",
    "uk": "Даю руку",
    "en": "Helping hand",
    "tags": "підтримка help"
  },
  {
    "emoji": "👀",
    "category": "gestures",
    "uk": "Дивлюся",
    "en": "Eyes",
    "tags": "увага curious"
  },
  {
    "emoji": "🤲",
    "category": "gestures",
    "uk": "Долоні",
    "en": "Open palms",
    "tags": "підтримка support"
  },
  {
    "emoji": "✍️",
    "category": "gestures",
    "uk": "Пишу",
    "en": "Writing",
    "tags": "повідомлення write"
  },
  {
    "emoji": "🤙",
    "category": "gestures",
    "uk": "Зателефонуй",
    "en": "Call me",
    "tags": "дзвінок call"
  },
  {
    "emoji": "☕",
    "category": "life",
    "uk": "Кава",
    "en": "Coffee",
    "tags": "зустріч cafe"
  },
  {
    "emoji": "🫖",
    "category": "life",
    "uk": "Чай",
    "en": "Tea",
    "tags": "затишок cup"
  },
  {
    "emoji": "🍵",
    "category": "life",
    "uk": "Зелений чай",
    "en": "Green tea",
    "tags": "чай cup"
  },
  {
    "emoji": "🍫",
    "category": "life",
    "uk": "Шоколад",
    "en": "Chocolate",
    "tags": "солодощі sweet"
  },
  {
    "emoji": "🍓",
    "category": "life",
    "uk": "Полуниця",
    "en": "Strawberry",
    "tags": "ягоди fruit"
  },
  {
    "emoji": "🍒",
    "category": "life",
    "uk": "Вишні",
    "en": "Cherries",
    "tags": "ягоди fruit"
  },
  {
    "emoji": "🍰",
    "category": "life",
    "uk": "Тортик",
    "en": "Cake",
    "tags": "солодощі birthday"
  },
  {
    "emoji": "🍕",
    "category": "life",
    "uk": "Піца",
    "en": "Pizza",
    "tags": "їжа food"
  },
  {
    "emoji": "🍣",
    "category": "life",
    "uk": "Суші",
    "en": "Sushi",
    "tags": "їжа food"
  },
  {
    "emoji": "🥂",
    "category": "life",
    "uk": "Келихи",
    "en": "Cheers",
    "tags": "зустріч свято celebrate"
  },
  {
    "emoji": "🎉",
    "category": "life",
    "uk": "Свято",
    "en": "Party popper",
    "tags": "ура confetti"
  },
  {
    "emoji": "🎊",
    "category": "life",
    "uk": "Конфеті",
    "en": "Confetti",
    "tags": "свято party"
  },
  {
    "emoji": "🎁",
    "category": "life",
    "uk": "Подарунок",
    "en": "Gift",
    "tags": "сюрприз present"
  },
  {
    "emoji": "🎂",
    "category": "life",
    "uk": "День народження",
    "en": "Birthday cake",
    "tags": "свято birthday"
  },
  {
    "emoji": "⭐",
    "category": "life",
    "uk": "Зірка",
    "en": "Star",
    "tags": "блиск sky"
  },
  {
    "emoji": "🌟",
    "category": "life",
    "uk": "Сяюча зірка",
    "en": "Glowing star",
    "tags": "блиск bright"
  },
  {
    "emoji": "💫",
    "category": "life",
    "uk": "Запаморочення",
    "en": "Dizzy star",
    "tags": "вау wow"
  },
  {
    "emoji": "🌙",
    "category": "life",
    "uk": "Місяць",
    "en": "Moon",
    "tags": "ніч goodnight"
  },
  {
    "emoji": "☀️",
    "category": "life",
    "uk": "Сонце",
    "en": "Sun",
    "tags": "ранок morning"
  },
  {
    "emoji": "🌈",
    "category": "life",
    "uk": "Веселка",
    "en": "Rainbow",
    "tags": "радість color"
  },
  {
    "emoji": "🍀",
    "category": "life",
    "uk": "Удача",
    "en": "Lucky clover",
    "tags": "успіх luck"
  },
  {
    "emoji": "🌿",
    "category": "life",
    "uk": "Прогулянка",
    "en": "Green sprig",
    "tags": "природа nature"
  },
  {
    "emoji": "🌊",
    "category": "life",
    "uk": "Море",
    "en": "Wave",
    "tags": "вода beach"
  },
  {
    "emoji": "🐾",
    "category": "life",
    "uk": "Лапки",
    "en": "Paw prints",
    "tags": "тварини pets"
  },
  {
    "emoji": "🐶",
    "category": "life",
    "uk": "Песик",
    "en": "Dog",
    "tags": "тварини puppy"
  },
  {
    "emoji": "🐱",
    "category": "life",
    "uk": "Котик",
    "en": "Cat",
    "tags": "тварини kitten"
  },
  {
    "emoji": "🦊",
    "category": "life",
    "uk": "Лисичка",
    "en": "Fox",
    "tags": "тварини animal"
  },
  {
    "emoji": "🐻",
    "category": "life",
    "uk": "Ведмедик",
    "en": "Bear",
    "tags": "тварини teddy"
  },
  {
    "emoji": "🧸",
    "category": "life",
    "uk": "Плюшевий ведмедик",
    "en": "Teddy bear",
    "tags": "милота gift"
  },
  {
    "emoji": "🎵",
    "category": "life",
    "uk": "Музика",
    "en": "Music note",
    "tags": "пісня song"
  },
  {
    "emoji": "🎧",
    "category": "life",
    "uk": "Навушники",
    "en": "Headphones",
    "tags": "музика music"
  },
  {
    "emoji": "🎬",
    "category": "life",
    "uk": "Кіно",
    "en": "Movie",
    "tags": "фільм cinema"
  },
  {
    "emoji": "🎮",
    "category": "life",
    "uk": "Ігри",
    "en": "Gaming",
    "tags": "game"
  },
  {
    "emoji": "📚",
    "category": "life",
    "uk": "Книги",
    "en": "Books",
    "tags": "читання reading"
  },
  {
    "emoji": "📷",
    "category": "life",
    "uk": "Фото",
    "en": "Camera",
    "tags": "фотографія photo"
  },
  {
    "emoji": "✈️",
    "category": "life",
    "uk": "Подорож",
    "en": "Travel",
    "tags": "літак flight"
  },
  {
    "emoji": "🚀",
    "category": "life",
    "uk": "Вперед",
    "en": "Rocket",
    "tags": "успіх launch"
  },
  {
    "emoji": "💻",
    "category": "life",
    "uk": "Технології",
    "en": "Laptop",
    "tags": "робота tech"
  },
  {
    "emoji": "🧑‍💻",
    "category": "life",
    "uk": "Програміст",
    "en": "Programmer",
    "tags": "робота code developer"
  },
  {
    "emoji": "💯",
    "category": "life",
    "uk": "Сто відсотків",
    "en": "Hundred points",
    "tags": "точно perfect"
  },
  {
    "emoji": "✅",
    "category": "life",
    "uk": "Готово",
    "en": "Done",
    "tags": "так check"
  },
  {
    "emoji": "🇺🇦",
    "category": "life",
    "uk": "Україна",
    "en": "Ukraine",
    "tags": "прапор flag"
  }
];
  const byEmoji=new Map(catalog.map(item=>[item.emoji,item]));
  const popular=['🥰','😉','😍','🥹','🫶','❤️','😘','🔥','✨','😏','💋','🤍','😊','🤩','😂','🫠','🙈','🤗','👌','👍','☕','🌹','😌','🎉'];
  const categories=[
    ['popular','✨','Популярні','Popular'],['faces','🙂','Емоції','Feelings'],
    ['love','🫶','Флірт і серця','Flirt and hearts'],['gestures','👋','Жести','Gestures'],
    ['life','☕','Життя','Life'],['recent','🕘','Нещодавні','Recent']
  ];
  const normalizeQuery=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
  function searchCatalog(query){
    const q=normalizeQuery(query).slice(0,80);
    const categoryWords={faces:'емоції смайли настрій feelings smile mood',love:'серце серця любов флірт heart love flirt',gestures:'руки жести hands gestures',life:'життя повсякденні life everyday'};
    return catalog.filter(item=>normalizeQuery(item.emoji+' '+item.uk+' '+item.en+' '+item.tags+' '+categoryWords[item.category]).includes(q));
  }
  function sanitizeRecents(value){
    if(!Array.isArray(value))return [];
    const result=[];
    for(const emoji of value.slice(0,100)){
      if(typeof emoji==='string'&&byEmoji.has(emoji)&&!result.includes(emoji))result.push(emoji);
      if(result.length===24)break;
    }
    return result;
  }
  function selectionRange(value,start,end){
    const limit=value.length;
    const clamp=n=>Math.max(0,Math.min(limit,Number.isFinite(n)?Math.trunc(n):limit));
    let left=clamp(start),right=Math.max(left,clamp(end));
    const boundaries=[0];
    if(typeof Intl.Segmenter==='function'){
      for(const part of new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(value))boundaries.push(part.index+part.segment.length);
    }else{
      let offset=0;for(const point of value){offset+=point.length;boundaries.push(offset)}
    }
    if(left===right){
      left=boundaries.find(n=>n>=left)??limit;right=left;
    }else{
      left=boundaries.filter(n=>n<=left).pop()??0;
      right=boundaries.find(n=>n>=right)??limit;
    }
    return {start:left,end:right};
  }
  function insertAtSelection(value,start,end,emoji,maxLength=2000){
    value=String(value??'');
    if(!byEmoji.has(emoji))return {ok:false,reason:'unknown',value};
    const range=selectionRange(value,start,end);
    const limit=Number.isFinite(maxLength)&&maxLength>=0?Math.trunc(maxLength):2000;
    const next=value.slice(0,range.start)+emoji+value.slice(range.end);
    if(next.length>limit)return {ok:false,reason:'limit',value};
    return {ok:true,value:next,caret:range.start+emoji.length,...range};
  }
  let emojiSequence;
  try{
    const base='(?:\\p{Extended_Pictographic}|\\p{Emoji_Presentation})\\uFE0F?\\p{Emoji_Modifier}?';
    emojiSequence=new RegExp('(?:\\p{Regional_Indicator}{2}|[0-9#*]\\uFE0F?\\u20E3|'+base+'(?:\\u200D'+base+')*)','gu');
  }catch{}
  function isEmojiMessage(value){
    if(typeof value!=='string'||value.length>128||!emojiSequence)return false;
    const compact=value.replace(/\s/g,'');
    if(!compact)return false;
    emojiSequence.lastIndex=0;
    const parts=compact.match(emojiSequence)||[];
    return parts.length>=1&&parts.length<=3&&parts.join('')===compact;
  }
  function create(config){
    const doc=config.content.ownerDocument;
    const memory=new Map();
    let binding=null;
    const t=(uk,en)=>config.language?.()==='en'?en:uk;
    const chatKey=()=>{const chat=config.chat?.();return chat?.matchId?String(config.userId?.()??'')+':'+String(chat.matchId):''};
    const permitted=()=>typeof config.allowed!=='function'||!!config.allowed();
    const owner=()=>String(config.userId?.()??'');
    function storage(){try{return config.storage??doc.defaultView?.localStorage}catch{return null}}
    function recent(){
      const id=owner();if(!id)return [];
      try{
        const raw=storage()?.getItem('vybeEmojiRecent:'+id);
        if(raw!==null&&raw!==undefined){const clean=sanitizeRecents(JSON.parse(raw));memory.set(id,clean);return clean}
      }catch{}
      return sanitizeRecents(memory.get(id));
    }
    function rememberRecent(emoji){
      const id=owner();if(!id)return;
      const next=sanitizeRecents([emoji,...recent()]);memory.set(id,next);
      try{storage()?.setItem('vybeEmojiRecent:'+id,JSON.stringify(next))}catch{}
    }
    function element(tag,className,text){
      const el=doc.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;
    }
    function icon(kind){
      const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
      if(kind==='smile'){
        const circle=doc.createElementNS(svg.namespaceURI,'circle');circle.setAttribute('cx','12');circle.setAttribute('cy','12');circle.setAttribute('r','9');svg.append(circle);
      }
      const path=doc.createElementNS(svg.namespaceURI,'path');
      path.setAttribute('d',kind==='smile'?'M8 9h.01M16 9h.01M8 14a4 4 0 0 0 8 0':'M6 6l12 12M18 6 6 18');
      svg.append(path);return svg;
    }
    function listen(b,node,type,handler){node.addEventListener(type,handler);b.listeners.push(()=>node.removeEventListener(type,handler))}
    function remember(b){
      if(binding!==b)return;
      b.selection={start:b.input.selectionStart??b.input.value.length,end:b.input.selectionEnd??b.input.value.length};
    }
    function busy(b){return b.input.disabled||b.input.readOnly||!!doc.getElementById('mediaDraft')||!!doc.getElementById('vybeCall')}
    function close(focus=false){
      const b=binding;if(!b||b.panel.hidden)return;
      b.panel.hidden=true;b.toggle.setAttribute('aria-expanded','false');
      if(focus&&b.input.isConnected&&!busy(b)){
        b.input.focus({preventScroll:true});
        b.input.setSelectionRange(b.selection.start,b.selection.end);
      }
    }
    function dispose(){
      const b=binding;if(!b)return;binding=null;
      b.listeners.forEach(remove=>remove());b.panel.remove();b.toggle.remove();b.tools.classList.remove('withEmojiPicker');
    }
    function sync(){
      const b=binding;if(!b)return;
      if(!b.input.isConnected||config.sheet?.classList.contains('hidden')||!permitted()||b.key!==chatKey()){dispose();return}
      const blocked=busy(b);if(b.toggle.disabled!==blocked)b.toggle.disabled=blocked;
      if(blocked)close();
    }
    function pick(b,item){
      if(binding!==b||!permitted()||busy(b)||b.key!==chatKey())return;
      const selection=b.selection;
      const next=insertAtSelection(b.input.value,selection.start,selection.end,item.emoji,b.input.maxLength);
      if(!next.ok){
        b.notice.textContent=t('Повідомлення завелике — звільни трохи місця для емодзі.','Message is full — make a little room for an emoji.');return;
      }
      b.input.setRangeText(item.emoji,next.start,next.end,'end');
      b.input.setSelectionRange(next.caret,next.caret);remember(b);b.notice.textContent='';
      b.input.dispatchEvent(new doc.defaultView.Event('input',{bubbles:true}));
      rememberRecent(item.emoji);try{config.onPick?.()}catch{}
    }
    function render(b){
      if(binding!==b)return;
      for(const [id,button] of b.categoryButtons)button.setAttribute('aria-pressed',String(id===b.category));
      const query=b.search.value;
      let items;
      if(normalizeQuery(query))items=searchCatalog(query);
      else if(b.category==='recent')items=recent().map(emoji=>byEmoji.get(emoji));
      else if(b.category==='popular')items=popular.map(emoji=>byEmoji.get(emoji));
      else items=catalog.filter(item=>item.category===b.category);
      b.grid.replaceChildren();
      if(!items.length){
        b.grid.append(element('p','emojiEmpty',normalizeQuery(query)?t('Нічого не знайдено. Спробуй «серце» або «кава».','No results. Try “heart” or “coffee”.'):t('Обрані емодзі з’являться тут.','Your chosen emoji will appear here.')));return;
      }
      for(const item of items){
        const button=element('button','emojiChoice',item.emoji);button.type='button';
        const label=t(item.uk,item.en);button.setAttribute('aria-label',label);button.title=label;
        button.dataset.emoji=item.emoji;button.onclick=()=>pick(b,item);b.grid.append(button);
      }
      b.grid.scrollTop=0;
    }
    function open(){
      sync();const b=binding;if(!b||busy(b))return;
      remember(b);b.input.blur();b.search.value='';b.panel.hidden=false;b.toggle.setAttribute('aria-expanded','true');b.notice.textContent='';
      render(b);b.closeButton.focus({preventScroll:true});
    }
    function mount(){
      const input=config.content.querySelector('#chatMessage'),tools=config.content.querySelector('#chatComposerTools');
      const key=chatKey();if(!input||!tools||!key||!permitted()){dispose();return}
      if(binding?.input===input&&binding.key===key){if(binding.panel.hidden)remember(binding);sync();return}
      dispose();
      const b={input,tools,key,listeners:[],selection:{start:input.value.length,end:input.value.length},category:recent().length?'recent':'popular',categoryButtons:new Map()};
      binding=b;
      b.toggle=element('button','emojiShell chatEmojiToggle');b.toggle.type='button';b.toggle.id='chatEmojiToggle';
      b.toggle.setAttribute('aria-label',t('Емодзі','Emoji'));b.toggle.title=t('Емодзі','Emoji');b.toggle.setAttribute('aria-expanded','false');b.toggle.setAttribute('aria-controls','chatEmojiPicker');
      b.toggle.append(icon('smile'),element('span','',t('Емодзі','Emoji')));
      tools.classList.add('withEmojiPicker');tools.insertBefore(b.toggle,tools.firstChild);
      b.panel=element('section','emojiShell emojiPicker');b.panel.id='chatEmojiPicker';b.panel.hidden=true;b.panel.setAttribute('role','region');b.panel.setAttribute('aria-label',t('Вибір емодзі','Emoji picker'));
      const header=element('div','emojiHeader');header.append(element('b','',t('Емодзі','Emoji')));
      b.closeButton=element('button','emojiClose');b.closeButton.type='button';b.closeButton.setAttribute('aria-label',t('Закрити емодзі','Close emoji'));b.closeButton.append(icon('close'));header.append(b.closeButton);
      b.search=element('input','emojiSearch');b.search.type='search';b.search.maxLength=60;b.search.placeholder=t('Пошук: серце, кава, обійми…','Search: heart, coffee, hugs…');b.search.setAttribute('aria-label',t('Пошук емодзі','Search emoji'));b.search.setAttribute('autocomplete','off');b.search.setAttribute('enterkeyhint','search');
      const categoryRow=element('div','emojiCategories');categoryRow.setAttribute('role','group');categoryRow.setAttribute('aria-label',t('Категорії емодзі','Emoji categories'));
      for(const [id,art,uk,en] of categories){
        const button=element('button','emojiCategory',art);button.type='button';button.setAttribute('aria-label',t(uk,en));button.title=t(uk,en);b.categoryButtons.set(id,button);
        button.onclick=()=>{b.category=id;b.search.value='';b.notice.textContent='';render(b)};categoryRow.append(button);
      }
      b.grid=element('div','emojiGrid');b.grid.setAttribute('role','group');b.grid.setAttribute('aria-label',t('Емодзі для повідомлення','Emoji for your message'));
      b.notice=element('p','emojiNotice');b.notice.setAttribute('role','status');b.notice.setAttribute('aria-live','polite');
      b.panel.append(header,b.search,categoryRow,b.grid,b.notice);tools.before(b.panel);
      listen(b,b.toggle,'click',()=>b.panel.hidden?open():close(true));
      listen(b,b.closeButton,'click',()=>close(true));
      listen(b,b.search,'input',()=>render(b));
      for(const event of ['input','select','keyup','pointerup'])listen(b,input,event,()=>remember(b));
      listen(b,input,'focus',()=>{remember(b);close()});
      listen(b,doc,'pointerdown',event=>{if(!b.panel.hidden&&!b.panel.contains(event.target)&&!b.toggle.contains(event.target))close()});
      listen(b,doc,'keydown',event=>{if(event.key==='Escape'&&!b.panel.hidden){event.preventDefault();event.stopPropagation();close(true)}});
      render(b);remember(b);sync();
    }
    const Observer=doc.defaultView.MutationObserver;
    const contentObserver=new Observer(sync);contentObserver.observe(config.content,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','readonly']});
    const bodyObserver=new Observer(sync);bodyObserver.observe(doc.body,{childList:true});
    const sheetObserver=new Observer(sync);if(config.sheet)sheetObserver.observe(config.sheet,{attributes:true,attributeFilter:['class']});
    const onHidden=()=>{if(doc.visibilityState==='hidden')close()};doc.addEventListener('visibilitychange',onHidden);
    function destroy(){dispose();contentObserver.disconnect();bodyObserver.disconnect();sheetObserver.disconnect();doc.removeEventListener('visibilitychange',onHidden)}
    return {mount,close,dispose,destroy,isOpen:()=>!!binding&&!binding.panel.hidden};
  }
  return Object.freeze({create,searchCatalog,sanitizeRecents,insertAtSelection,isEmojiMessage,catalog});
});
