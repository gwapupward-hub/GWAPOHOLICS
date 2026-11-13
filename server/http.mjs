/**
 * HTTP controller for Vercel Node functions. No production session or
 * database works until required environment variables are provisioned.
 */
import {verifyTelegramInitData,TelegramInitDataError} from './telegram-auth.mjs';
import {issueSessionCookie,parseSessionCookie,clearSessionCookie} from './session.mjs';
import {executeGameCommand} from './game-service.mjs';

const jsonHeaders={
 'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'no-store, private',
 'X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'no-referrer',
 'Vary':'Cookie'
};
function send(res,status,body,cookie){
 res.statusCode=status;
 for(const [k,v] of Object.entries(jsonHeaders))res.setHeader(k,v);
 if(cookie)res.setHeader('Set-Cookie',cookie);
 res.end(JSON.stringify(body));
}
function sameOrigin(req){
 const origin=req.headers?.origin;
 const host=req.headers?.['x-forwarded-host']||req.headers?.host;
 if(typeof origin!=='string'||!host||Array.isArray(host))return false;
 try{
  const url=new URL(origin);
  return url.protocol==='https:'&&url.host===host&&!url.username&&!url.password;
 }catch{return false}
}
function authorizedMutation(req){
 return sameOrigin(req)&&req.headers?.['x-gwap-request']==='1'&&
  /^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers?.['content-type']||'');
}
async function jsonBody(req,maxBytes=17_000){
 let size=0,parts=[];
 for await(const chunk of req){
  size+=chunk.length;if(size>maxBytes)throw new Error('Request too large');
  parts.push(chunk);
 }
 let data;try{data=JSON.parse(Buffer.concat(parts).toString('utf8'))}catch{throw new Error('Invalid JSON')}
 if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Expected JSON object');
 return data;
}
function exactKeys(body,keys){
 return Object.keys(body).every(k=>keys.includes(k));
}
export async function handleSession(req,res,{botToken,sessionSecret,now=Date.now()}={}){
 if(req.method!=='POST'){send(res,405,{error:'method_not_allowed'});return}
 if(!authorizedMutation(req)){send(res,403,{error:'forbidden_origin'});return}
 if(!botToken||!sessionSecret){send(res,503,{error:'authentication_unavailable'});return}
 let body;
 try{body=await jsonBody(req)}catch{send(res,400,{error:'invalid_request'});return}
 if(!exactKeys(body,['initData'])||typeof body.initData!=='string'){send(res,400,{error:'invalid_request'});return}
 try{
  const claim=verifyTelegramInitData(body.initData,{botToken,now});
  const cookie=issueSessionCookie(claim.userId,{secret:sessionSecret,now});
  send(res,200,{authenticated:true,expiresInSeconds:3600},cookie);
 }catch(e){
  if(e instanceof TelegramInitDataError){send(res,401,{error:'invalid_telegram_launch'});return}
  send(res,503,{error:'authentication_unavailable'});
 }
}
export async function handleLogout(req,res){
 if(req.method!=='POST'){send(res,405,{error:'method_not_allowed'});return}
 if(!authorizedMutation(req)){send(res,403,{error:'forbidden_origin'});return}
 send(res,200,{authenticated:false},clearSessionCookie());
}
export async function handleGame(req,res,{sessionSecret,store,now=Date.now()}={}){
 if(!['GET','POST'].includes(req.method)){send(res,405,{error:'method_not_allowed'});return}
 if(!sessionSecret||!store){send(res,503,{error:'game_service_unavailable'});return}
 let session;
 try{session=parseSessionCookie(req.headers?.cookie,{secret:sessionSecret,now})}catch{
  send(res,503,{error:'game_service_unavailable'});return
 }
 if(!session){send(res,401,{error:'sign_in_required'});return}
 let payload={command:'snapshot'};
 if(req.method==='POST'){
  if(!authorizedMutation(req)){send(res,403,{error:'forbidden_origin'});return}
  try{payload=await jsonBody(req,4096)}catch{send(res,400,{error:'invalid_request'});return}
  if(!exactKeys(payload,['command','requestId','caseId','choiceId','answers'])||
    !['start','choose','recover'].includes(payload.command)){
   send(res,400,{error:'invalid_command'});return
  }
 }
 try{
  const state=await executeGameCommand({store,userId:session.userId,now,...payload});
  send(res,200,{state});
 }catch(e){
  const message=String(e?.message||'');
  if(/not configured|not exist|database|connection|timeout|unavailable/i.test(message)){
   send(res,503,{error:'game_service_unavailable'});return
  }
  if(/duplicate idempotency|requestId reused/i.test(message)){
   send(res,409,{error:'request_id_conflict'});return
  }
  if(/unknown|invalid|cannot|already|complete|balance|recovery|quest|scenario|decision|first|chain|minimum|locked/i.test(message)){
   send(res,409,{error:'invalid_game_action'});return
  }
  send(res,503,{error:'game_service_unavailable'});
 }
}
