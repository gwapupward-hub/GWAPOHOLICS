#!/usr/bin/env node
import {probePreviewAuth} from './preview-auth-probe.mjs';

const url=process.env.GWAP_PREVIEW_URL;
if(!url){
  console.error('Preview monitor: GWAP_PREVIEW_URL is required');
  process.exitCode=1;
}else{
  let last;
  for(let attempt=1;attempt<=2;attempt++){
    try {last=await probePreviewAuth({origin:url});}
    catch {last={ok:false,results:[{name:'configuration',ok:false,error:'invalid_preview_origin'}]};}
    if(last.ok)break;
    if(attempt===1)await new Promise(resolve=>setTimeout(resolve,3000));
  }
  // Never print the URL or request payload, credentials, cookies, or headers.
  console.log(JSON.stringify(last));
  if(!last.ok)process.exitCode=1;
}
