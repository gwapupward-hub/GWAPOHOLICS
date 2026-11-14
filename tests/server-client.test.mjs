import test from 'node:test';
import assert from 'node:assert/strict';
import {hydratePlayerState,startTelegramSession,sendGameCommand,refreshPlayer} from '../server-client.mjs';
function sample(){
 return {state:{balance:1000,completed:[],draft:null,profile:{riskAppetite:0},ledger:[{
  id:'welcome-1',type:'welcome',label:'Starting capital',amount:1000,balanceAfter:1000,at:1
 }],evidence:{'streaming-pivot':[]},lastRecoveryAt:null,seed:123456}};
}
test('hydrates public state without accepting seed or internal ledger identity data',()=>{
 const g=hydratePlayerState(sample());
 assert.equal(g.remote,true);assert.equal(g.balance,1000);
 assert.equal('seed' in g,false);
 assert.equal(g.ledger.length,1);
});
test('starts Telegram session and refreshes via credentialed same-origin requests',async()=>{
 const log=[];
 const fetcher=async(path,opts)=>{
  log.push({path,opts});
  if(path==='/api/session')return {ok:true,status:200,json:async()=>({authenticated:true})};
  if(path==='/api/game')return {ok:true,status:200,json:async()=>sample()};
  throw Error('wrong route');
 };
 const x=await startTelegramSession('signed-launch',{fetcher});
 assert.equal(x.balance,1000);
 assert.equal(log.length,2);
 assert.equal(log[0].path,'/api/session');
 assert.equal(log[0].opts.credentials,'same-origin');
 assert.equal(log[1].opts.method,'GET');
 assert.equal(JSON.parse(log[0].opts.body).initData,'signed-launch');
});
test('submits no client balance or hidden payout',async()=>{
 let cmd;
 const fetcher=async(_url,opts)=>{cmd=JSON.parse(opts.body);return {ok:true,status:200,json:async()=>sample()};};
 await sendGameCommand({command:'choose',caseId:'streaming-pivot',choiceId:'a',requestId:'0001'},{fetcher});
 assert.deepEqual(Object.keys(cmd).sort(),['caseId','choiceId','command','requestId']);
});
test('refuses failed secure endpoint instead of falling back to local balances',async()=>{
 const fetcher=async()=>({ok:false,status:503});
 await assert.rejects(()=>startTelegramSession('data',{fetcher}),/unavailable/);
 await assert.rejects(()=>refreshPlayer({fetcher}),/unavailable/);
});
