#!/usr/bin/env node
/**
 * Controlled, opt-in Preview-only ingress test. Sends no Telegram credentials.
 * Usage: GWAP_PREVIEW_URL=https://<approved-preview>.vercel.app
 *        GWAP_WAF_TEST_CONFIRM=PREVIEW_ONLY node scripts/verify-preview-waf.mjs
 * WARNING: This deliberately reaches the configured 20/IP/60s rate limit.
 */
const origin=process.env.GWAP_PREVIEW_URL;
if(process.env.GWAP_WAF_TEST_CONFIRM!=='PREVIEW_ONLY')throw new Error('Explicit PREVIEW_ONLY confirmation required');
if(!origin)throw new Error('GWAP_PREVIEW_URL required');
const url=new URL(origin);
if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('Expected bare HTTPS Preview origin');
if(!url.hostname.endsWith('.vercel.app'))throw new Error('Only Vercel Preview hosts permitted');
if(/^(www\.|gwapoholics\.|gwapspot\.)/.test(url.hostname))throw new Error('Refusing apparent public hostname');
const results=[];
for(let i=0;i<22;i++){
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),5000);
 try{
  const response=await fetch(new URL('/api/session',url),{
   method:'POST',headers:{'content-type':'application/json','x-gwap-command':'1'},
   body:'{}',signal:controller.signal,redirect:'manual'
  });
  results.push(response.status);
  await response.body?.cancel();
  if(response.status===429)break;
  if(response.status>=300&&response.status<400)break;
 }catch(err){console.error('Request failed:',err.name);break}
 finally{clearTimeout(timeout)}
}
console.log(JSON.stringify({requests:results.length,statuses:results,rateLimited:results.includes(429)},null,2));
if(results.includes(429))console.log('PASS: observed HTTP 429. Check Vercel firewall event to attribute the response to the configured rule.');
else{console.error('INCONCLUSIVE: no HTTP 429 observed. Confirm Preview routing and WAF scope; do not treat as pass.');process.exitCode=1}
