/**
 * Credential-free Preview ingress health probe.
 *
 * Uses only unauthenticated requests and synthetically INVALID Telegram data.
 * No player cookies, real initData, DB writes, or customer PII are used.
 * The responses verify the auth boundary, not successful DB connectivity.
 */
const APPROVED_PREVIEW_HOST='gwap-telegram-business-sim-git-fe-c57750-bigdaddygwaps-projects.vercel.app';
export function validatePreviewOrigin(origin) {
  let url;
  try { url = new URL(origin); } catch { throw new Error('Invalid Preview URL'); }
  if (url.protocol !== 'https:' || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash ||
      url.hostname !== APPROVED_PREVIEW_HOST) {
    throw new Error('Expected approved release-candidate Preview branch alias');
  }
  return url.origin;
}

export async function probePreviewAuth({origin, fetchImpl=fetch, timeoutMs=7000}={}) {
  const base=validatePreviewOrigin(origin);
  const mutationHeaders={'Origin':base,'x-gwap-request':'1','Content-Type':'application/json'};
  const probes=[
    {name:'unauthenticated_game',path:'/api/game',status:401,error:'sign_in_required',options:{method:'GET'}},
    {name:'invalid_session_payload',path:'/api/session',status:400,error:'invalid_request',
      options:{method:'POST',headers:mutationHeaders,body:'{}'}},
    {name:'invalid_telegram_signature',path:'/api/session',status:401,error:'invalid_telegram_launch',
      options:{method:'POST',headers:mutationHeaders,
        body:JSON.stringify({initData:'auth_date=1&hash=invalid'})}}
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
    const ok=response.status===p.status && error===p.error && !response.headers?.get?.('set-cookie');
    results.push({name:p.name,ok,status:response.status,error});
    if (!ok) break;
  }
  return {ok:results.length===probes.length && results.every(x=>x.ok),results};
}
