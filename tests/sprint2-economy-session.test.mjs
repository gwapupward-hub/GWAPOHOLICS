import test from 'node:test';
import assert from 'node:assert/strict';
import {CASES,RECOVERY_QUESTIONS} from '../cases.mjs';
import {
  createGame,isLocked,recoveryAvailable,completeRecovery,
  RECOVERY_REWARD,RECOVERY_COOLDOWN_MS,MIN_PLAY_BALANCE
} from '../game-core.mjs';
import {executeGameCommand} from '../server/game-service.mjs';

function durableTestStore(initial=null){
  let game=initial,queue=Promise.resolve();
  const receipts=new Map();
  return {
    transaction(_uid,fn){
      const task=queue.then(async()=>{
        let next=game;
        const staged=new Map();
        const result=await fn({
          async getGame(){return next},
          async setGame(value){next=value},
          async getReceipt(key,hash){
            const previous=receipts.get(key);
            if(previous&&previous.hash!==hash)throw Error('requestId reused for another command');
            return previous?.value??null;
          },
          async setReceipt(key,value,hash){staged.set(key,{value,hash})}
        });
        game=next;
        for(const [key,value] of staged)receipts.set(key,value);
        return result;
      });
      queue=task.catch(()=>{});
      return task;
    },
    get game(){return game}
  };
}

test('recovery is available only when locked and respects cooldown without repeat rewards',()=>{
  const now=1800000000000;
  const locked={...createGame(now,123),balance:0};
  assert.equal(isLocked(locked),true);
  assert.equal(recoveryAvailable(locked,now),true);
  const answers=RECOVERY_QUESTIONS.map(q=>q.correct);
  const recovered=completeRecovery(locked,answers,now);
  assert.equal(recovered.balance,RECOVERY_REWARD);
  assert.equal(recovered.ledger.filter(x=>x.type==='recovery').length,1);
  assert.equal(recoveryAvailable(recovered,now+RECOVERY_COOLDOWN_MS-1),false);
  assert.throws(()=>completeRecovery(recovered,answers,now+RECOVERY_COOLDOWN_MS-1),/cooldown/i);
  assert.equal(recoveryAvailable(recovered,now+RECOVERY_COOLDOWN_MS),true);
  const second=completeRecovery(recovered,answers,now+RECOVERY_COOLDOWN_MS);
  assert.equal(second.balance,2*RECOVERY_REWARD);
  assert.equal(second.ledger.filter(x=>x.type==='recovery').length,2);
  assert.equal(isLocked(second),false);
  assert.equal(recoveryAvailable(second,now+2*RECOVERY_COOLDOWN_MS),false);
  assert.throws(()=>completeRecovery(second,answers,now+2*RECOVERY_COOLDOWN_MS),/cooldown/i);
  assert.equal(MIN_PLAY_BALANCE,100);
});

test('invalid recovery answers cannot mint coins or change the ledger',()=>{
  const now=1800000000000;
  const locked={...createGame(now,234),balance:40};
  const wrong=RECOVERY_QUESTIONS.map(q=>q.correct);
  wrong[0]=-1;
  assert.throws(()=>completeRecovery(locked,wrong,now),/answer/i);
  assert.equal(locked.balance,40);
  assert.equal(locked.ledger.length,1);
  assert.equal(locked.lastRecoveryAt,null);
});

test('fresh session snapshots resume the same draft and never settle an unfinished quest',async()=>{
  const store=durableTestStore();
  const uid='1414141414',now=1800000000000;
  const quest=CASES[0];
  const initial=await executeGameCommand({store,userId:uid,command:'snapshot',now});
  assert.equal(initial.balance,1000);
  await executeGameCommand({store,userId:uid,command:'start',caseId:quest.id,requestId:'begin',now});
  const first=await executeGameCommand({
    store,userId:uid,command:'choose',caseId:quest.id,
    choiceId:quest.stages[0].options[0].id,requestId:'decision-1',now:now+1
  });
  const reopened=await executeGameCommand({store,userId:uid,command:'snapshot',now:now+60000});
  assert.deepEqual(reopened.draft,first.draft);
  assert.equal(reopened.balance,1000);
  assert.equal(reopened.completed.length,0);
  assert.equal(reopened.ledger.filter(x=>x.type==='case').length,0);
  const retry=await executeGameCommand({
    store,userId:uid,command:'choose',caseId:quest.id,
    choiceId:quest.stages[0].options[0].id,requestId:'decision-1',now:now+60001
  });
  assert.deepEqual(retry,first);
  assert.equal(store.game.draft.path.length,1);
});
