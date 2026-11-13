/**
 * Server-authoritative game command service. All mutations MUST run in a
 * database transaction with a per-player lock and persisted idempotency keys.
 * This file does not implement a live database adapter or HTTP endpoint.
 */
import {randomBytes,createHash} from 'node:crypto';
import {CASES,RECOVERY_QUESTIONS} from '../cases.mjs';
import {
  createGame, startCase, chooseStep, completeChain, completeRecovery,
  isLocked, recoveryAvailable, stageView, chainResult, evidenceFor, isValidGame
} from '../game-core.mjs';

function requireString(s,name,max=90){
  if(typeof s!=='string'||!s.length||s.length>max||!(/^[a-zA-Z0-9_-]+$/).test(s))
    throw new Error('Invalid '+name);
  return s;
}
function requireIdentity(userId){
  if(!/^[1-9][0-9]{0,18}$/.test(String(userId||'')))throw new Error('Valid Telegram identity required');
  return String(userId);
}
export function publicGameView(game,now=Date.now()){
  if(!isValidGame(game))throw new Error('Invalid authoritative game state');
  const quest=game.draft&&CASES.find(c=>c.id===game.draft.caseId);
  const draft=game.draft?{
    caseId:game.draft.caseId,
    path:[...game.draft.path],
    round:game.draft.path.length,
    step:quest&&game.draft.path.length<4?stageView(quest,game.draft.path,game.seed):null
  }:null;
  // Render only earned results. No random seed or future choice payoffs escape.
  const completed=game.played.map(run=>{
    const caseData=CASES.find(c=>c.id===run.caseId);
    const earned=caseData?chainResult(caseData,run.path,game.seed):null;
    return {
      caseId:run.caseId,path:[...run.path],delta:run.delta,band:run.band,
      balanceAfter:run.balanceAfter,at:run.at,
      result:earned?{
        band:earned.band,verdict:earned.verdict,narrative:earned.narrative,
        steps:earned.steps.map(x=>({
          prompt:x.prompt,label:x.label,delta:x.delta,
          reasons:x.reasons,outcome:x.outcome
        }))
      }:null
    };
  });
  const evidence=Object.fromEntries(CASES.map(entry=>[entry.id,evidenceFor(entry,game.seed)]));
  return Object.freeze({
    balance:game.balance,
    completed,draft,evidence,
    profile:{...game.profile},
    ledger:game.ledger.map(({id,type,label,amount,balanceAfter,at})=>({
      id,type,label,amount,balanceAfter,at
    })),
    locked:isLocked(game),
    recoveryAvailable:recoveryAvailable(game,now),
    lastRecoveryAt:game.lastRecoveryAt
  });
}

/**
 * Transaction abstraction:
 * store.transaction(userId, fn) serializes mutations for a user and MUST
 * atomically commit any calls to tx.setGame and tx.setReceipt.
 * tx.getReceipt returns a prior result for the same idempotency key.
 */
export async function executeGameCommand({store,userId,command,requestId,caseId,choiceId,answers,now=Date.now()}={}){
  const uid=requireIdentity(userId);
  if(!store||typeof store.transaction!=='function')throw new Error('Authoritative store unavailable');
  if(!['snapshot','start','choose','recover'].includes(command))throw new Error('Unknown command');
  if(command!=='snapshot')requireString(requestId,'requestId',96);
  const requestHash=command==='snapshot'?null:createHash('sha256')
    .update(JSON.stringify({command,caseId:caseId??null,choiceId:choiceId??null,answers:answers??null}))
    .digest('hex');
  return store.transaction(uid,async tx=>{
    if(command!=='snapshot'){
      const receipt=await tx.getReceipt(requestId,requestHash);
      if(receipt)return receipt;
    }
    let game=await tx.getGame();
    if(!game){
      const seed=randomBytes(4).readUInt32BE(0);
      game=createGame(now,seed);
      await tx.setGame(game);
    }
    if(!isValidGame(game))throw new Error('Corrupt authoritative player record');
    if(command==='snapshot')return publicGameView(game,now);
    if(command==='start'){
      requireString(caseId,'caseId');
      game=startCase(game,caseId);
    }else if(command==='choose'){
      requireString(caseId,'caseId');
      requireString(choiceId,'choiceId');
      game=chooseStep(game,caseId,choiceId);
      const quest=CASES.find(x=>x.id===caseId);
      if(game.draft.path.length===quest.stages.length){
        game=completeChain(game,caseId,now); // atomic with the final choice
      }
    }else if(command==='recover'){
      if(!Array.isArray(answers)||answers.length!==RECOVERY_QUESTIONS.length||
         !answers.every(x=>Number.isInteger(x)&&x>=0&&x<=4))throw new Error('Invalid recovery answers');
      game=completeRecovery(game,answers,now);
    }
    await tx.setGame(game);
    const result=publicGameView(game,now);
    await tx.setReceipt(requestId,result,requestHash);
    return result;
  });
}
