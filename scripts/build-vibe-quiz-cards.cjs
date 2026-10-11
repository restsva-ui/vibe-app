/* Deterministic public artwork: brand asset + vector layout, no user data. */
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const requireRuntime=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/'):require;
const sharp=requireRuntime('sharp'),{types}=require('../vibe-quiz.js');
const logo=fs.readFileSync(path.join(__dirname,'../assets/vybe-logo-source.png')).toString('base64');
const escape=s=>s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const icons={
 spark:'<path d="M464 290 375 427h72l-10 110 90-148h-73z" fill="currentColor"/>',
 explorer:'<circle cx="450" cy="410" r="104" fill="none" stroke="currentColor" stroke-width="9"/><path d="m497 356-24 81-70 28 24-81z" fill="currentColor"/><circle cx="450" cy="410" r="11" fill="#171b25"/>',
 cozy:'<path d="M450 499c-14-12-105-74-105-130 0-47 64-68 105-18 41-50 105-29 105 18 0 56-91 118-105 130z" fill="currentColor"/>',
 talker:'<path d="M351 344h139a30 30 0 0 1 30 30v49a30 30 0 0 1-30 30H396l-45 35v-35a30 30 0 0 1-30-30v-49a30 30 0 0 1 30-30z" fill="none" stroke="currentColor" stroke-width="8"/><path d="M526 384h25a30 30 0 0 1 30 30v63a30 30 0 0 1-30 30v27l-38-27h-75a30 30 0 0 1-30-30" fill="none" stroke="currentColor" stroke-width="8"/><circle cx="372" cy="398" r="7" fill="currentColor"/><circle cx="420" cy="398" r="7" fill="currentColor"/><circle cx="468" cy="398" r="7" fill="currentColor"/>'
};
function wrap(text,max=36){const lines=[''];for(const word of text.split(' ')){const i=lines.length-1;if(lines[i]&&lines[i].length+word.length+1>max)lines.push(word);else lines[i]+=(lines[i]?' ':'')+word;}return lines;}
(async()=>{
 for(const [key,info] of Object.entries(types))for(const lang of ['uk','en']){
  const lines=wrap(info[lang+'Text']);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="900" height="1200" viewBox="0 0 900 1200">
   <defs><radialGradient id="glow"><stop stop-color="${info.color}" stop-opacity=".18"/><stop offset="1" stop-color="${info.color}" stop-opacity="0"/></radialGradient></defs>
   <rect width="900" height="1200" fill="#11141b"/><circle cx="450" cy="395" r="380" fill="url(#glow)"/>
   <rect x="42" y="42" width="816" height="1116" rx="45" fill="none" stroke="#ffffff" stroke-opacity=".12" stroke-width="2"/>
   <image x="195" y="75" width="510" height="170" xlink:href="data:image/png;base64,${logo}"/>
   <text x="450" y="280" text-anchor="middle" fill="#afb3c0" font-family="DejaVu Sans,sans-serif" font-size="25" letter-spacing="5">${lang==='uk'?'ТВІЙ ВАЙБ':'YOUR VIBE'}</text>
   <circle cx="450" cy="413" r="130" fill="${info.color}" fill-opacity=".055" stroke="${info.color}" stroke-opacity=".24" stroke-width="2"/>
   <g color="${info.color}">${icons[key]}</g>
   <text x="450" y="642" text-anchor="middle" fill="#f2f3f7" font-family="DejaVu Sans,sans-serif" font-weight="bold" font-size="${key==='talker'&&lang==='uk'?66:76}">${escape(info[lang])}</text>
   ${lines.map((line,i)=>`<text x="450" y="721" dy="${i*45}" text-anchor="middle" fill="#bfc3d0" font-family="DejaVu Sans,sans-serif" font-size="30">${escape(line)}</text>`).join('')}
   <rect x="130" y="921" width="640" height="91" rx="25" fill="${info.color}" fill-opacity=".1" stroke="${info.color}" stroke-opacity=".45"/>
   <text x="450" y="978" text-anchor="middle" fill="${info.color}" font-family="DejaVu Sans,sans-serif" font-weight="bold" font-size="30">${lang==='uk'?'А який вайб у тебе?':'What is your vibe?'}</text>
   <text x="450" y="1069" text-anchor="middle" fill="#9ca1af" font-family="DejaVu Sans,sans-serif" font-size="23">@vybe_now_bot · 18+</text>
  </svg>`;
  const file=path.join(__dirname,'../assets/vybe-quiz-'+key+'-'+lang+'.jpg');
  await sharp(Buffer.from(svg)).jpeg({quality:88,mozjpeg:true}).toFile(file);
  console.log(path.basename(file),fs.statSync(file).size+' bytes');
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
