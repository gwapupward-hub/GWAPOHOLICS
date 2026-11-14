/**
 * Telegram-only authoritative state client. Demo mode stays local-only.
 * Never persist raw Telegram initData, server cookies, or real player balance
 * in localStorage. Credentials are HttpOnly and automatically sent by browser.
 */
function requireSuccess(response){
 if(!response?.ok)throw new Error(response?.status===401?'Telegram session expired':response?.status===429?'Too many actions. Please try again in one minute.':'Secure game service unavailable');
 return response;
}
function authorizedHeaders(){return {'Content-Type':'application/json','X-GWAP-Request':'1'};}
export function hydratePlayerState(body){
 const state=body?.state||body;
 if(!state||!Number.isSafeInteger(state.balance)||state.balance<0||!Array.isArray(state.completed)||
    !state.profile||!Array.isArray(state.ledger)||!state.evidence||typeof state.evidence!=='object')
  throw new Error('Invalid authenticated player response');
 const draft=state.draft?{
  caseId:state.draft.caseId,
  path:Array.isArray(state.draft.path)?[...state.draft.path]:[],
  step:state.draft.step||null
 }:null;
 return {
  remote:true,balance:state.balance,
  played:state.completed.map(run=>({...run})),
  draft,profile:{...state.profile},
  ledger:state.ledger.map(entry=>({...entry})),
  evidence:state.evidence,lastRecoveryAt:state.lastRecoveryAt
 };
}
export async function startTelegramSession(rawInitData,{fetcher=fetch}={}){
 if(typeof rawInitData!=='string'||!rawInitData)throw new Error('Open GWAPOHOLICS inside Telegram');
 const a=await fetcher('/api/session',{
  method:'POST',credentials:'same-origin',cache:'no-store',
  headers:authorizedHeaders(),body:JSON.stringify({initData:rawInitData})
 });
 requireSuccess(a);
 return refreshPlayer({fetcher});
}
export async function refreshPlayer({fetcher=fetch}={}){
 const r=await fetcher('/api/game',{method:'GET',credentials:'same-origin',cache:'no-store'});
 requireSuccess(r);
 return hydratePlayerState(await r.json());
}
export async function sendGameCommand({command,caseId,choiceId,answers,requestId},{fetcher=fetch}={}){
 if(!['start','choose','recover'].includes(command))throw new Error('Unknown game command');
 if(typeof requestId!=='string'||!requestId)throw new Error('Missing unique request ID');
 const body={command,requestId};
 if(caseId!==undefined)body.caseId=caseId;
 if(choiceId!==undefined)body.choiceId=choiceId;
 if(answers!==undefined)body.answers=answers;
 const r=await fetcher('/api/game',{
  method:'POST',credentials:'same-origin',cache:'no-store',
  headers:authorizedHeaders(),body:JSON.stringify(body)
 });
 requireSuccess(r);
 return hydratePlayerState(await r.json());
}
