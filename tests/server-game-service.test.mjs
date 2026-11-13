import test from 'node:test';
import assert from 'node:assert/strict';
import {CASES,RECOVERY_QUESTIONS} from '../cases.mjs';
import {createGame} from '../game-core.mjs';
import {executeGameCommand,publicGameView} from '../server/game-service.mjs';

// A lock-serialized test store; not a production persistence implementation.
function testStore(seed=123){
  let game=createGame(1700000000000,seed), queue=Promise.resolve();
  const receipts=new Map();
  return{
    transaction(_uid,fn){
      const job=queue.then(async()=> {
        let pending=game;
        const pendingReceipts=new Map();
        const result=await fn({
          async getGame(){return pending;},
          async setGame(g){pending=g;},
          async getReceipt(k,h){const found=receipts.get(k);if(found&&found.hash!==h)throw Error('requestId reused for another command');return found?.result||null;},
          async setReceipt(k,v,h){pendingReceipts.set(k,{hash:h,result:v});}
        });
        game=pending;for(const [k,v] of pendingReceipts)receipts.set(k,v);
        return result;
      });
      queue=job.catch(()=>{});return job;
    },
    get game(){return game;}
  };
}
const uid='1234567',id='streaming-pivot',caseData=CASES.find(c=>c.id===id);
test('public game state never sends seed, hidden deltas or internal ledger',()=>{
 const g=createGame(1700000000000,34);
 const v=publicGameView(g);
 assert.equal(v.balance,1000);
 assert.equal('seed' in v,false);
 assert.equal('ledger' in v,false);
 assert.equal('profile' in v,false);
});
test('four choices settle in one transaction and duplicated retry is idempotent',async()=>{
 const store=testStore();
 await executeGameCommand({store,userId:uid,command:'start',caseId:id,requestId:'req-start'});
 const outcomes=[];
 for(let i=0;i<4;i++){
  const choiceId=caseData.stages[i].options[0].id;
  outcomes.push(await executeGameCommand({store,userId:uid,command:'choose',caseId:id,choiceId,requestId:'choice-'+i,now:1700000000000+i}));
 }
 assert.equal(outcomes[3].completed.length,1);
 assert.equal(store.game.played.length,1);
 assert.equal(store.game.ledger.filter(x=>x.type==='case').length,1);
 const again=await executeGameCommand({store,userId:uid,command:'choose',caseId:id,choiceId:caseData.stages[3].options[0].id,requestId:'choice-3',now:1700000000600});
 assert.deepEqual(again,outcomes[3]);
 assert.equal(store.game.ledger.filter(x=>x.type==='case').length,1);
 await assert.rejects(()=>executeGameCommand({store,userId:uid,command:'choose',caseId:id,choiceId:caseData.stages[3].options[0].id,requestId:'new-request-after-settle'}));
});
test('simultaneous identical requests are serialized and cannot award twice',async()=>{
 const store=testStore(234);
 await executeGameCommand({store,userId:uid,command:'start',caseId:id,requestId:'start-2'});
 for(let i=0;i<3;i++)await executeGameCommand({store,userId:uid,command:'choose',caseId:id,choiceId:caseData.stages[i].options[0].id,requestId:'pre-'+i});
 const props={store,userId:uid,command:'choose',caseId:id,choiceId:caseData.stages[3].options[0].id,requestId:'final',now:1700000001000};
 const [a,b]=await Promise.all([executeGameCommand(props),executeGameCommand(props)]);
 assert.deepEqual(a,b);
 assert.equal(store.game.played.length,1);
 assert.equal(store.game.ledger.filter(x=>x.type==='case').length,1);
});
test('rejects malformed identity, unknown choice, client-controlled balance and invalid recovery',async()=>{
 const store=testStore();
 await assert.rejects(()=>executeGameCommand({store,userId:'someone',command:'snapshot'}),/Telegram identity/);
 await executeGameCommand({store,userId:uid,command:'start',caseId:id,requestId:'req-start'});
 await assert.rejects(()=>executeGameCommand({store,userId:uid,command:'choose',caseId:id,choiceId:'fake-option',requestId:'bad-choice'}),/Unknown decision/);
 assert.equal(store.game.draft.path.length,0);
 await assert.rejects(()=>executeGameCommand({store,userId:uid,command:'recover',answers:[0],requestId:'bad-recovery'}),/recovery answers/);
 const snapshot=await executeGameCommand({store,userId:uid,command:'snapshot',balance:999999,seed:0});
 assert.equal(snapshot.balance,1000);
});

test('idempotency key cannot be reused for a different command',async()=>{
 const store=testStore();
 await executeGameCommand({store,userId:uid,command:'start',caseId:id,requestId:'shared-key'});
 await assert.rejects(()=>executeGameCommand({store,userId:uid,command:'start',caseId:'brand-backlash',requestId:'shared-key'}),/requestId reused/);
});
