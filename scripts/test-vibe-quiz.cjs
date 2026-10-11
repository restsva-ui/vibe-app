const assert=require('node:assert/strict'),quiz=require('../vibe-quiz.js');
const keys=Object.keys(quiz.types);
for(let n=0;n<4**5;n++){
 let x=n;const answers=Array.from({length:5},()=>{const key=keys[x%4];x=Math.floor(x/4);return key;});
 const counts=Object.fromEntries(keys.map(k=>[k,answers.filter(a=>a===k).length]));
 const expected=answers.find(k=>counts[k]===Math.max(...Object.values(counts)));
 assert.equal(quiz.calculate(answers),expected);
}
for(const answers of [null,[],['spark'],['spark','spark','spark','spark','evil'],Array(5)])assert.equal(quiz.calculate(answers),null);
assert.deepEqual(quiz.parseStart('qz_talker_v123'),{type:'talker',referral:'v123'});
assert.deepEqual(quiz.parseStart('QZ_SPARK'),{type:'spark',referral:null});
for(const code of ['qz_bad_v1','qz_spark_v','qz_spark_v1?x=2','qz_spark_v1_extra','ref_v1','tt_video','qz_spark_v'+'a'.repeat(15)])assert.equal(quiz.parseStart(code),null);
assert.deepEqual(quiz.fromLaunch('https://fixture.invalid/?quiz=cozy&ref=v1',{}),{type:'cozy',referral:'v1'});
assert.equal(quiz.fromLaunch('https://fixture.invalid/?quiz=cozy&ref=v1',{initData:'start_param=tt_signed'}),null,'URL cannot override a signed unrelated launch');
assert.deepEqual(quiz.fromLaunch('https://fixture.invalid/?quiz=cozy&ref=v1',{initData:'start_param=qz_spark_v2',initDataUnsafe:{start_param:'qz_talker_v3'}}),{type:'spark',referral:'v2'});
assert.equal(quiz.imageUrl('evil','uk','https://fixture.invalid/'),null);
assert.match(quiz.imageUrl('spark','en','https://fixture.invalid/app/'),/\/app\/assets\/vybe-quiz-spark-en\.jpg/);
console.log('Quiz scoring: all 1024 complete answer combinations, malformed inputs and launch precedence passed');
