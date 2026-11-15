/**
 * Credential-free, read-only Preview ingress probe.
 *
 * No Telegram initData, cookies, DB mutations, or customer PII are used.
 * Request outcomes prove HTTP auth-path availability, not DB health.
 */
export function validatePreviewOrigin(origin) {
  let url;
  try { url = new URL(origin); } catch { throw new Error('Invalid Preview URL'); }
  if (url.protocol !== 'https:' || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash ||
      !/^gwap-telegram-business-[a-z0-9-]+-bigdaddygwaps-projects\.vercel\.app$/.test(url.hostname)) {
    throw new Error('Expected the approved GWAPOHOLICS Vercel Preview hostname');
  }
  return url.origin;
}

export async function probePreviewAuth({origin, fetchImpl=fetch, timeoutMs=7000}={}) {
  const base=validatePreviewOrigin(origin);
  const probes=[
    {name:'unauthenticated_game',path:'/api/game',status:401,error:'sign_in_required',options:{method:'GET'}},
    {name:'invalid_session_payload',path:'/api/session',status:400,error:'invalid_request',
      options:{method:'POST',headers:{'Origin':base,'x-gwap-request':'1','Content-Type':'application/json'},body:'{}'}}
  ];
  const results=[];
  for (const p of probes) {
    let response;
    try {
      response=await fetchImpl(base+p.path,{...p.options,redirect:'manual',signal:AbortSignal.timeout(timeoutMs)});
    } catch {
      results.push({name:p.name,ok:false,status:null,error:'network_or_timeout'});
      break;
    }
    let body=null;
    try { body=await response.json(); } catch {}
    const error=typeof body?.error==='string' ? body.error : null;
    const ok=response.status===p.status && error===p.error;
    results.push({name:p.name,ok,status:response.status,error});
    if (!ok) break;
  }
  return {ok:results.length===probes.length && results.every(x=>x.ok),results};
}
