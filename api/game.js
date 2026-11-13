import {handleGame} from '../server/http.mjs';
import {getPostgresStore} from '../server/postgres-store.mjs';
export default async function handler(req,res){
 if(!process.env.DATABASE_URL||!process.env.GWAP_SESSION_SECRET){
  res.statusCode=503;
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/json');
  res.end(JSON.stringify({error:'game_service_unavailable'}));
  return;
 }
 return handleGame(req,res,{sessionSecret:process.env.GWAP_SESSION_SECRET,store:await getPostgresStore()});
}
