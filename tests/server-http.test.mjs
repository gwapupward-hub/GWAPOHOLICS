import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createHmac} from 'node:crypto';
import {handleSession,handleGame,handleLogout} from '../server/http.mjs';
import {createGame} from '../game-core.mjs';
const SECRET='a'.repeat(48),BOT='TEST_BOT_TOKEN_NOT_REAL_1234567890',NOW=1800000000000;
function telegramLaunch(){
 const q=new URLSearchParams({user:JSON.stringify({id:1234567,first_name:'Test'}),auth_date:String(Math.floor(NOW/1000)),query_id:'demo'});
 const check=[...q.entries()].map(([k,v])=>k+'='+v).sort().join('\n');
 const key=createHmac('sha256','WebAppData').update(BOT).digest();
 q.set('hash',createHmac('sha256',key).update(check).digest('hex'));
 return q.toString();
}
function req(method,body,extra={}){
 const headers={
  host:'app.example.test',origin:'https://app.example.test','x-gwap-request':'1',
  'content-type':'application/json',...extra
 };
 const bytes=body==null?[]:[Buffer.from(JSON.stringify(body))];
 return Object.assign(Readable.from(bytes),{method,headers});
}
function res(){
 const headers={};
 return {
  statusCode:200,body:'',
  setHeader(name,value){headers[name.toLowerCase()]=value},
  getHeader(name){return headers[name.toLowerCase()]},
  end(body=''){this.body=body},
 };
}
function getStore(){
 const game=createGame(NOW,123);
 return {transaction(_user,fn){return fn({
  async getGame(){return game},async setGame(){},async getReceipt(){return null},async setReceipt(){}
 })}};
}
test('server accepts signed Telegram launch with secure cookie and no raw identity in JSON body',async()=>{
 const output=res();
 await handleSession(req('POST',{initData:telegramLaunch()}),output,{botToken:BOT,sessionSecret:SECRET,now:NOW});
 assert.equal(output.statusCode,200);
 assert.deepEqual(JSON.parse(output.body),{authenticated:true,expiresInSeconds:3600});
 assert.match(output.getHeader('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
 const gameRes=res();
 const cookie=output.getHeader('set-cookie').split(';')[0];
 await handleGame(req('GET',null,{cookie}),gameRes,{sessionSecret:SECRET,store:getStore(),now:NOW});
 assert.equal(gameRes.statusCode,200);
 const data=JSON.parse(gameRes.body);
 assert.equal(data.state.balance,1000);
 assert.equal('seed' in data.state,false);
});
test('fake signed data, invalid origins and missing secrets fail closed',async()=>{
 let o=res();
 await handleSession(req('POST',{initData:telegramLaunch().replace('1234567','9999999')}),o,{botToken:BOT,sessionSecret:SECRET,now:NOW});
 assert.equal(o.statusCode,401);
 o=res();
 await handleSession(req('POST',{initData:telegramLaunch()},{origin:'https://attacker.example'}),o,{botToken:BOT,sessionSecret:SECRET,now:NOW});
 assert.equal(o.statusCode,403);
 o=res();
 await handleSession(req('POST',{initData:telegramLaunch()}),o,{botToken:null,sessionSecret:null,now:NOW});
 assert.equal(o.statusCode,503);
 o=res();
 await handleGame(req('GET'),o,{sessionSecret:SECRET,store:getStore(),now:NOW});
 assert.equal(o.statusCode,401);
});
test('malicious client balances or forged post from another origin are rejected',async()=>{
 const s=res();
 await handleSession(req('POST',{initData:telegramLaunch()}),s,{botToken:BOT,sessionSecret:SECRET,now:NOW});
 const cookie=s.getHeader('set-cookie').split(';')[0];
 let out=res();
 await handleGame(req('POST',{command:'start',caseId:'streaming-pivot',requestId:'id1',balance:999999},{cookie}),out,{sessionSecret:SECRET,store:getStore(),now:NOW});
 assert.equal(out.statusCode,400);
 out=res();
 await handleGame(req('POST',{command:'start',caseId:'streaming-pivot',requestId:'id2'},{cookie,origin:'https://attacker.example'}),out,{sessionSecret:SECRET,store:getStore(),now:NOW});
 assert.equal(out.statusCode,403);
 out=res();
 await handleLogout(req('POST',{}),out);
 assert.match(out.getHeader('set-cookie'),/Max-Age=0/);
});
