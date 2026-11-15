import test from 'node:test';
import assert from 'node:assert/strict';
import {probePreviewAuth,validatePreviewOrigin} from '../scripts/preview-auth-probe.mjs';

const origin='https://gwap-telegram-business-r8brisqm4-bigdaddygwaps-projects.vercel.app';
const json=(status,error)=>new Response(JSON.stringify({error}),{status,headers:{'content-type':'application/json'}});

test('restricts monitor to GWAPOHOLICS HTTPS Vercel Preview hosts',()=>{
  assert.equal(validatePreviewOrigin(origin),origin);
  for(const bad of [
    'https://gwapspot.com','http://gwap-telegram-business-r8brisqm4-bigdaddygwaps-projects.vercel.app',
    'https://user:secret@gwap-telegram-business-r8brisqm4-bigdaddygwaps-projects.vercel.app',
    origin+'/api/game',origin+'?key=secret','https://other-app.vercel.app','not a url'
  ])assert.throws(()=>validatePreviewOrigin(bad));
});

test('passes only when both protected endpoints reject unauthenticated/invalid requests correctly',async()=>{
  const calls=[];
  const result=await probePreviewAuth({origin,fetchImpl:async(url,opts)=>{
    calls.push({url,opts});
    return calls.length===1 ? json(401,'sign_in_required') : json(400,'invalid_request');
  }});
  assert.equal(result.ok,true);
  assert.equal(result.results.length,2);
  assert.equal(calls[0].opts.method,'GET');
  assert.equal(calls[1].opts.method,'POST');
  assert.equal(calls[1].opts.headers.Origin,origin);
  assert.equal(calls[1].opts.headers['x-gwap-request'],'1');
  assert.equal(calls[1].opts.body,'{}');
  assert.equal(calls[1].opts.redirect,'manual');
});

test('fails closed on unexpected status, error body, redirects and network failures',async()=>{
  for(const response of [
    json(503,'game_service_unavailable'),json(401,'different_error'),
    new Response('',{status:302,headers:{Location:'/login'}})
  ]){
    const result=await probePreviewAuth({origin,fetchImpl:async()=>response.clone()});
    assert.equal(result.ok,false);
    assert.equal(result.results.length,1);
  }
  const timeout=await probePreviewAuth({origin,fetchImpl:async()=>{throw Error('network unavailable')}});
  assert.equal(timeout.ok,false);
  assert.equal(timeout.results[0].error,'network_or_timeout');
});

test('second endpoint errors fail the probe',async()=>{
  let i=0;
  const result=await probePreviewAuth({origin,fetchImpl:async()=>{
    i++;
    return i===1 ? json(401,'sign_in_required') : json(429,'rate_limited');
  }});
  assert.equal(result.ok,false);
  assert.equal(result.results.length,2);
  assert.equal(result.results[1].status,429);
});
