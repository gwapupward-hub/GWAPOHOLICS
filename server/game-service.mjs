/**
 * Server-authoritative game command service. All mutations MUST run in a
 * database transaction with a per-player lock and persisted idempotency keys.
 * This file does not implement a live database adapter or HTTP endpoint.
 */
import {randomBytes} from 'node:crypto';
import {CASES,RECOVERY_QUESTIONS} from '../cases.mjs';
import {
  createGame, startCase, chooseStep, completeChain, completeRecovery,
  isLocked, recoveryAvailable, stageView, chainResult, isValidGame
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
    round:game.draft.path.length,
    step:quest&&game.draft.path.length<4?stageView(quest,game.draft.path,game.seed):null
  }:null;
  return Object.freeze({
    balance:game.balance,
    completed:game.played.map(r=>({caseId:r.caseId,band:r.band,delta:r.delta,balanceAfter:r.balanceAfter,completedAt:r.at})),
    draft,
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
  return store.transaction(uid,async tx=>{
    if(command!=='snapshot'){
      const receipt=await tx.getReceipt(requestId);
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
    await tx.setReceipt(requestId,result);
    return result;
  });
}
