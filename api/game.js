import {handleGame} from '../server/http.mjs';
import {getPostgresStore} from '../server/postgres-store.mjs';
import {readRestrictedBetaUsers,betaUnavailable} from '../server/beta-access.mjs';

function unavailable(res){
  res.statusCode=503;
  res.setHeader('Cache-Control','no-store, private');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.end(JSON.stringify({error:'game_service_unavailable'}));
}
export default async function handler(req,res){
  // Guard snapshots as well as writes: old cookies must not bypass the allowlist.
  let betaAllowedUserIds;
  try {betaAllowedUserIds=readRestrictedBetaUsers(process.env)}
  catch {betaUnavailable(res);return}
  if(!process.env.DATABASE_URL||!process.env.GWAP_SESSION_SECRET){
    unavailable(res);return;
  }
  try{
    const store=await getPostgresStore();
    return await handleGame(req,res,{
      sessionSecret:process.env.GWAP_SESSION_SECRET,
      previousSessionSecret:process.env.GWAP_SESSION_SECRET_PREVIOUS,
      betaAllowedUserIds,store
    });
  }catch{
    if(!res.headersSent)unavailable(res);
  }
}
