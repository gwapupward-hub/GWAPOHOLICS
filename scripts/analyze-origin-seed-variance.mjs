// READ-ONLY analysis. Quantifies how much the random evidence regime (the per-run seed) can distort the link
// between decision quality and Origin capital under the DRAFT policy. It changes nothing: no scoring, no data.
//   node scripts/analyze-origin-seed-variance.mjs            # JSON
//   node scripts/analyze-origin-seed-variance.mjs --markdown # tables for docs
import {CASES} from '../cases.mjs';
import {isShifted,resolvedPath} from '../game-core.mjs';
import {ORIGIN_POLICIES,scoreQuest} from '../server/v2/origin-policy.mjs';

const policy=ORIGIN_POLICIES['origin-v1-draft'];
const quests=policy.questIds.map(id=>CASES.find(c=>c.id===id));

function repSeed(quest,shifted){for(let s=0;s<100000;s+=1)if(isShifted(quest,s)===shifted)return s;throw new Error('no seed');}
function paths(quest){
 const ids=quest.stages.map(s=>s.options.map(o=>o.id)),out=[];
 for(const a of ids[0])for(const b of ids[1])for(const c of ids[2])for(const d of ids[3])out.push([a,b,c,d]);
 return out;
}
const pct=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(p*s.length))];};
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;

// P(shifted) is exact from the driver definition; the hash-based assignment is checked empirically below.
const perQuest=quests.map(q=>{
 const {min,max,shiftWhen,threshold}=q.driver;
 let n=0;for(let v=min;v<=max;v+=1)if(shiftWhen==='below'?v<threshold:v>=threshold)n+=1;
 const pShift=n/(max-min+1);
 let hits=0;const N=20000;for(let s=0;s<N;s+=1)if(isShifted(q,s))hits+=1;
 const regimes={};
 for(const shifted of [false,true]){
  const seed=repSeed(q,shifted);
  const scores=paths(q).map(p=>scoreQuest(policy,q.id,resolvedPath(q,p,seed).reduce((s,x)=>s+x.delta,0)));
  regimes[shifted?'shifted':'unshifted']={scores,worst:Math.min(...scores),median:pct(scores,.5),best:Math.max(...scores),mean:Math.round(mean(scores))};
 }
 return {id:q.id,pShift,empiricalShift:hits/N,regimes};
});

// Regime-blind path: the single path with the best probability-weighted score (a skilled player who ignores the evidence).
const paths81=quests.map(paths);
const blind=perQuest.map((q,i)=>{
 let best=-1,pick=0;
 paths81[i].forEach((_,k)=>{const e=q.pShift*q.regimes.shifted.scores[k]+(1-q.pShift)*q.regimes.unshifted.scores[k];if(e>best){best=e;pick=k;}});
 return pick;
});

// Exact distribution of a run total for a per-quest score picker, over all 2^5 regime combinations.
function distribution(pick){
 let dist=new Map([[0,1]]);
 perQuest.forEach((q,i)=>{
  const next=new Map();
  for(const [total,p] of dist)for(const [regime,pr] of [['shifted',q.pShift],['unshifted',1-q.pShift]]){
   const s=pick(q,i,regime);
   next.set(total+s,(next.get(total+s)||0)+p*pr);
  }
  dist=next;
 });
 return [...dist.entries()].map(([score,p])=>({score,p})).sort((a,b)=>a.score-b.score);
}
const oracle=distribution((q,i,r)=>q.regimes[r].best);
const blindBest=distribution((q,i,r)=>q.regimes[r].scores[blind[i]]);
const medianPlay=distribution((q,i,r)=>q.regimes[r].median);
const worstPlay=distribution((q,i,r)=>q.regimes[r].worst);

// Random play: Monte Carlo with a fixed seed so the numbers are reproducible.
let state=123456789;const rnd=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
const randomTotals=[];
for(let n=0;n<200000;n+=1){let t=0;perQuest.forEach(q=>{const r=rnd()<q.pShift?'shifted':'unshifted';t+=q.regimes[r].scores[Math.floor(rnd()*81)];});randomTotals.push(t);}

const q=(d,p)=>{let c=0;for(const x of d){c+=x.p;if(c>=p)return x.score;}return d.at(-1).score;};
const expect=d=>Math.round(d.reduce((s,x)=>s+x.score*x.p,0));
const probGE=(d,t)=>d.filter(x=>x.score>=t).reduce((s,x)=>s+x.p,0);
// P(run A strictly outscores an independent run B)
const beats=(a,b)=>a.reduce((s,x)=>s+x.p*b.filter(y=>y.score<x.score).reduce((t,y)=>t+y.p,0),0);
// E[best-of-k] for replays that each re-roll the regimes (credit follows the personal best)
const bestOfK=(d,k)=>{let prev=0,e=0;for(const x of d){const cdf=d.filter(y=>y.score<=x.score).reduce((s,y)=>s+y.p,0);const pk=Math.pow(cdf,k);e+=x.score*(pk-prev);prev=pk;}return Math.round(e);};
const toDist=arr=>{const m=new Map();for(const v of arr)m.set(v,(m.get(v)||0)+1);return [...m].map(([score,c])=>({score,p:c/arr.length})).sort((a,b)=>a.score-b.score);};
const randomDist=toDist(randomTotals);

const policies={oracle,blindBest,medianPlay,worstPlay,random:randomDist};
const summary=Object.fromEntries(Object.entries(policies).map(([name,d])=>[name,{
 min:d[0].score,p10:q(d,.1),median:q(d,.5),p90:q(d,.9),max:d.at(-1).score,mean:expect(d),
 bestOf3:bestOfK(d,3),bestOf10:bestOfK(d,10),bestOf25:bestOfK(d,25)
}]));
const result={
 policy:policy.version,maxScore:policy.perQuestMaxG*quests.length,
 perQuest:perQuest.map(p=>({quest:p.id,pShifted:+p.pShift.toFixed(3),empiricalShiftedSample:+p.empiricalShift.toFixed(3),
  unshifted:{worst:p.regimes.unshifted.worst,median:p.regimes.unshifted.median,best:p.regimes.unshifted.best},
  shifted:{worst:p.regimes.shifted.worst,median:p.regimes.shifted.median,best:p.regimes.shifted.best}})),
 totals:summary,
 oracleReaches:{atLeast2400:+probGE(oracle,2400).toFixed(4),atLeast2450:+probGE(oracle,2450).toFixed(4),exactly2500:+probGE(oracle,2500).toFixed(4)},
 luckSwing:{oracleBestSeedMinusWorstSeed:oracle.at(-1).score-oracle[0].score,blindBestSwing:blindBest.at(-1).score-blindBest[0].score,worstPlaySwing:worstPlay.at(-1).score-worstPlay[0].score},
 skillGapAtMedianLuck:{oracleMinusBlind:q(oracle,.5)-q(blindBest,.5),blindMinusMedianPlay:q(blindBest,.5)-q(medianPlay,.5)},
 inversion:{
  P_blindBest_beats_independent_oracle:+beats(blindBest,oracle).toFixed(3),
  P_medianPlay_beats_independent_blindBest:+beats(medianPlay,blindBest).toFixed(3),
  P_worstPlay_beats_independent_medianPlay:+beats(worstPlay,medianPlay).toFixed(3),
  P_random_beats_independent_blindBest:+beats(randomDist,blindBest).toFixed(3)
 }
};
if(process.argv.includes('--markdown')){
 console.log('| quest | P(shifted) | unshifted worst/median/best | shifted worst/median/best |\n| --- | ---: | --- | --- |');
 for(const p of result.perQuest)console.log(`| ${p.quest} | ${p.pShifted} | ${p.unshifted.worst} / ${p.unshifted.median} / ${p.unshifted.best} | ${p.shifted.worst} / ${p.shifted.median} / ${p.shifted.best} |`);
 console.log('\n| policy | min | p10 | median | p90 | max | mean | E[best of 3] | E[best of 10] | E[best of 25] |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
 for(const [n,s] of Object.entries(summary))console.log(`| ${n} | ${s.min} | ${s.p10} | ${s.median} | ${s.p90} | ${s.max} | ${s.mean} | ${s.bestOf3} | ${s.bestOf10} | ${s.bestOf25} |`);
 console.log('\n'+JSON.stringify({oracleReaches:result.oracleReaches,luckSwing:result.luckSwing,skillGapAtMedianLuck:result.skillGapAtMedianLuck,inversion:result.inversion},null,1));
}else console.log(JSON.stringify(result,null,1));
