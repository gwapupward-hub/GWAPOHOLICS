import {handleGame} from '../server/http.mjs';
import {getPostgresStore} from '../server/postgres-store.mjs';

function unavailable(res){
  res.statusCode=503;
  res.setHeader('Cache-Control','no-store, private');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.end(JSON.stringify({error:'game_service_unavailable'}));
}
export default async function handler(req,res){
  if(!process.env.DATABASE_URL||!process.env.GWAP_SESSION_SECRET){
    unavailable(res);return;
  }
  try{
    const store=await getPostgresStore();
    return await handleGame(req,res,{sessionSecret:process.env.GWAP_SESSION_SECRET,previousSessionSecret:process.env.GWAP_SESSION_SECRET_PREVIOUS,store});
  }catch{
    // Never leak the database hostname, credentials, or query text.
    if(!res.headersSent)unavailable(res);
  }
}
