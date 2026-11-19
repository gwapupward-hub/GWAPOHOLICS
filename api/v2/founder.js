import {handleFounder} from '../../server/v2/http.mjs';
import {getPostgresFounderStore} from '../../server/v2/postgres-founder-store.mjs';
import {loadV2Config} from '../../server/v2/config.mjs';

function reply(res,status,error){
  res.statusCode=status;
  res.setHeader('Cache-Control','no-store, private');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.end(JSON.stringify({error}));
}
export default async function handler(req,res){
  const config=loadV2Config(process.env);
  // Default OFF: behave like a missing route and never touch the database.
  if(!config.founderHubEnabled){reply(res,404,'not_found');return}
  if(!process.env.DATABASE_URL||!process.env.GWAP_SESSION_SECRET){reply(res,503,'founder_service_unavailable');return}
  try{
    const store=await getPostgresFounderStore();
    return await handleFounder(req,res,{config,sessionSecret:process.env.GWAP_SESSION_SECRET,previousSessionSecret:process.env.GWAP_SESSION_SECRET_PREVIOUS,store});
  }catch{
    if(!res.headersSent)reply(res,503,'founder_service_unavailable');
  }
}
