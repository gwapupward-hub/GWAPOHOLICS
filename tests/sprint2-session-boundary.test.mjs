import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createHmac} from 'node:crypto';
import {handleSession} from '../server/http.mjs';

const TOKEN='FAKE_TEST_TOKEN_NOT_A_REAL_TELEGRAM_SECRET';
const SECRET='s'.repeat(48);
const NOW=1800000000000;
function signedLaunch(authDate=Math.floor(NOW/1000)){
  const params=new URLSearchParams({
    user:JSON.stringify({id:1414141414,first_name:'Test'}),
    auth_date:String(authDate),query_id:'test'
  });
  const check=[...params.entries()].map(([k,v])=>k+'='+v).sort().join('\n');
  const key=createHmac('sha256','WebAppData').update(TOKEN).digest();
  params.set('hash',createHmac('sha256',key).update(check).digest('hex'));
  return params.toString();
}
function request(method,body,headers={}){
  const bytes=body===undefined?[]:[Buffer.from(JSON.stringify(body))];
  return Object.assign(Readable.from(bytes),{
    method,headers:{
      host:'preview.example.test',origin:'https://preview.example.test',
      'x-gwap-request':'1','content-type':'application/json',...headers
    }
  });
}
function response(){
  const headers={};
  return {statusCode:200,body:'',setHeader(k,v){headers[k.toLowerCase()]=v},
    getHeader(k){return headers[k.toLowerCase()]},end(value=''){this.body=value}};
}
async function send(method,body,headers={}){
  const res=response();
  await handleSession(request(method,body,headers),res,{botToken:TOKEN,sessionSecret:SECRET,now:NOW});
  return res;
}

test('session endpoint rejects non-POST methods without issuing cookies',async()=>{
  for(const method of ['GET','PUT','DELETE']){
    const res=await send(method,{initData:signedLaunch()});
    assert.equal(res.statusCode,405);
    assert.equal(res.getHeader('set-cookie'),undefined);
  }
});
test('session endpoint rejects wrong origins and absent custom mutation header',async()=>{
  for(const headers of [
    {origin:'https://other.example.test'},
    {'x-gwap-request':'0'},
    {'content-type':'text/plain'}
  ]){
    const res=await send('POST',{initData:signedLaunch()},headers);
    assert.equal(res.statusCode,403);
    assert.equal(res.getHeader('set-cookie'),undefined);
  }
});
test('session endpoint rejects expired Telegram initData and unexpected fields',async()=>{
  const expired=await send('POST',{initData:signedLaunch(Math.floor(NOW/1000)-3601)});
  assert.equal(expired.statusCode,401);
  assert.deepEqual(JSON.parse(expired.body),{error:'invalid_telegram_launch'});
  assert.equal(expired.getHeader('set-cookie'),undefined);
  const extra=await send('POST',{initData:signedLaunch(),userId:'999'});
  assert.equal(extra.statusCode,400);
  assert.equal(extra.getHeader('set-cookie'),undefined);
});
test('session endpoint returns a secure session for a fresh signed Telegram launch',async()=>{
  const res=await send('POST',{initData:signedLaunch()});
  assert.equal(res.statusCode,200);
  assert.match(res.getHeader('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
  assert.equal(res.getHeader('cache-control'),'no-store, private');
  assert.doesNotMatch(res.body,/initData|userId|token/i);
});
