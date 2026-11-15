import test from 'node:test';
import assert from 'node:assert/strict';
import {probePreviewAuth,validatePreviewOrigin} from '../scripts/preview-auth-probe.mjs';

const origin='https://gwap-telegram-business-sim-git-fe-c57750-bigdaddygwaps-projects.vercel.app';
const json=(status,error,headers={})=>new Response(JSON.stringify({error}),{status,headers:{'content-type':'application/json',...headers}});

test('restricts monitor to exact HTTPS release-candidate branch alias',()=>{
  assert.equal(validatePreviewOrigin(origin),origin);
  for(const bad of [
    'https://gwapspot.com',
    'http://gwap-telegram-business-sim-git-fe-c57750-bigdaddygwaps-projects.vercel.app',
    'https://user:secret@gwap-telegram-business-sim-git-fe-c57750-bigdaddygwaps-projects.vercel.app',
    origin+'/api/game',origin+'?key=secret',
    'https://gwap-telegram-business-sim-bigdaddygwaps-projects.vercel.app',
    'https://gwap-telegram-business-r8brisqm4-bigdaddygwaps-projects.vercel.app',
    'https://other-app.vercel.app','not a url'
  ])assert.throws(()=>validatePreviewOrigin(bad));
});

test('requires three credential-free auth-boundary results in order',async()=>{
  const calls=[];
  const result=await probePreviewAuth({origin,fetchImpl:async(url,opts)=>{
    calls.push({url,opts});
    if(calls.length===1)return json(401,'sign_in_required');
    if(calls.length===2)return json(400,'invalid_request');
    return json(401,'invalid_telegram_launch');
  }});
  assert.equal(result.ok,true);
  assert.equal(result.results.length,3);
  assert.deepEqual(result.results.map(x=>x.status),[401,400,401]);
  assert.equal(calls[0].opts.method,'GET');
  for(const i of [1,2]){
    assert.equal(calls[i].opts.method,'POST');
    assert.equal(calls[i].opts.headers.Origin,origin);
    assert.equal(calls[i].opts.headers['x-gwap-request'],'1');
    assert.equal(calls[i].opts.redirect,'manual');
  }
  assert.equal(calls[1].opts.body,'{}');
  assert.deepEqual(JSON.parse(calls[2].opts.body),{initData:'auth_date=1&hash=invalid'});
});

test('fails closed for unexpected HTTP results, redirects, cookies, and network issues',async()=>{
  for(const response of [
    json(503,'game_service_unavailable'),json(401,'different_error'),
    new Response('',{status:302,headers:{Location:'/login'}}),
    json(401,'sign_in_required',{'set-cookie':'session=fake'})
  ]){
    const result=await probePreviewAuth({origin,fetchImpl:async()=>response.clone()});
    assert.equal(result.ok,false);
    assert.equal(result.results.length,1);
  }
  const down=await probePreviewAuth({origin,fetchImpl:async()=>{throw Error('network unavailable')}});
  assert.equal(down.ok,false);
  assert.equal(down.results[0].error,'network_or_timeout');
});

test('second and third endpoint failures fail the probe without passing',async()=>{
  for(const failingIndex of [2,3]){
    let i=0;
    const result=await probePreviewAuth({origin,fetchImpl:async()=>{
      i++;
      if(i===failingIndex)return json(503,'authentication_unavailable');
      if(i===1)return json(401,'sign_in_required');
      if(i===2)return json(400,'invalid_request');
      return json(401,'invalid_telegram_launch');
    }});
    assert.equal(result.ok,false);
    assert.equal(result.results.length,failingIndex);
  }
});
