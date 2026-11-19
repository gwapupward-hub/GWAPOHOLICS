import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createHmac} from 'node:crypto';
import {readRestrictedBetaUsers,BetaConfigurationError} from '../server/beta-access.mjs';
import {handleSession,handleGame} from '../server/http.mjs';
import {createGame} from '../game-core.mjs';

const NOW=1800000000000,BOT='TEST_BETA_TOKEN_1234567890',SECRET='s'.repeat(48);
function signedLaunch(id){
 const q=new URLSearchParams({user:JSON.stringify({id,first_name:'Beta'}),auth_date:String(Math.floor(NOW/1000)),query_id:'synthetic'});
 const data=[...q.entries()].map(([key,value])=>key+'='+value).sort().join('\n');
 const secret=createHmac('sha256','WebAppData').update(BOT).digest();
 q.set('hash',createHmac('sha256',secret).update(data).digest('hex'));
 return q.toString();
}
function request(method,body,headers={}){
 return Object.assign(Readable.from(body==null?[]:[Buffer.from(JSON.stringify(body))]),{
   method,headers:{host:'beta.example.test',origin:'https://beta.example.test','x-gwap-request':'1',
   'content-type':'application/json',...headers}
 });
}
function response(){
 const headers={};
 return {statusCode:200,body:'',setHeader(k,v){headers[k.toLowerCase()]=v},getHeader(k){return headers[k.toLowerCase()]},
   end(x=''){this.body=x}};
}
test('beta config fails closed without explicit mode, list, or valid exact user IDs',()=>{
 for(const env of [{},{GWAP_BETA_MODE:'public',GWAP_BETA_ALLOWED_IDS:'1001'},
   {GWAP_BETA_MODE:'restricted'}, {GWAP_BETA_MODE:'restricted',GWAP_BETA_ALLOWED_IDS:''},
   {GWAP_BETA_MODE:'restricted',GWAP_BETA_ALLOWED_IDS:'1001,1001'},
   {GWAP_BETA_MODE:'restricted',GWAP_BETA_ALLOWED_IDS:'0,1001'},
   {GWAP_BETA_MODE:'restricted',GWAP_BETA_ALLOWED_IDS:'1001,abc'},
   {GWAP_BETA_MODE:'restricted',GWAP_BETA_ALLOWED_IDS:'9223372036854775808'},
   {GWAP_BETA_MODE:'restricted',GWAP_BETA_ALLOWED_IDS:Array.from({length:16},(_,i)=>String(i+1)).join(',')}
 ]) assert.throws(()=>readRestrictedBetaUsers(env),BetaConfigurationError);
 assert.deepEqual([...readRestrictedBetaUsers({GWAP_BETA_MODE:'restricted',GWAP_BETA_ALLOWED_IDS:'1001, 1002'})],['1001','1002']);
});
test('allowlist permits signed invited identity only',async()=>{
 const allowed=new Set(['1234567']);
 const out=response();
 await handleSession(request('POST',{initData:signedLaunch(1234567)}),out,{botToken:BOT,sessionSecret:SECRET,betaAllowedUserIds:allowed,now:NOW});
 assert.equal(out.statusCode,200);
 assert.match(out.getHeader('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
 assert.doesNotMatch(out.body,/1234567/);
 const denied=response();
 await handleSession(request('POST',{initData:signedLaunch(7654321)}),denied,{botToken:BOT,sessionSecret:SECRET,betaAllowedUserIds:allowed,now:NOW});
 assert.equal(denied.statusCode,403);
 assert.deepEqual(JSON.parse(denied.body),{error:'beta_invite_required'});
 assert.equal(denied.getHeader('set-cookie'),undefined);
 assert.doesNotMatch(denied.body,/7654321/);
});
test('previously signed session cannot read or mutate beta game if not on current list',async()=>{
 const accepted=response();
 await handleSession(request('POST',{initData:signedLaunch(7654321)}),accepted,{botToken:BOT,sessionSecret:SECRET,now:NOW});
 assert.equal(accepted.statusCode,200);
 const cookie=accepted.getHeader('set-cookie').split(';')[0];
 let transactions=0;
 const store={transaction(){transactions++;return Promise.resolve({})}};
 const blockedRead=response();
 await handleGame(request('GET',null,{cookie}),blockedRead,{sessionSecret:SECRET,store,betaAllowedUserIds:new Set(['1234567']),now:NOW});
 assert.equal(blockedRead.statusCode,403);
 const blockedWrite=response();
 await handleGame(request('POST',{command:'start',caseId:'streaming-pivot',requestId:'x'},{cookie}),blockedWrite,{sessionSecret:SECRET,store,betaAllowedUserIds:new Set(['1234567']),now:NOW});
 assert.equal(blockedWrite.statusCode,403);
 assert.equal(transactions,0);
});
test('invited session can access authoritative snapshot',async()=>{
 const invited=response();
 await handleSession(request('POST',{initData:signedLaunch(1234567)}),invited,{botToken:BOT,sessionSecret:SECRET,betaAllowedUserIds:new Set(['1234567']),now:NOW});
 const cookie=invited.getHeader('set-cookie').split(';')[0];
 const game=createGame(NOW,123);
 const store={transaction(_uid,fn){return fn({async getGame(){return game}})}};
 const snap=response();
 await handleGame(request('GET',null,{cookie}),snap,{sessionSecret:SECRET,store,betaAllowedUserIds:new Set(['1234567']),now:NOW});
 assert.equal(snap.statusCode,200);
 assert.equal(JSON.parse(snap.body).state.balance,1000);
});
