/**
 * Fail-closed admission for the GWAPOHOLICS iOS controlled beta.
 * Telegram IDs are sensitive: only server-side Vercel environment secrets hold them.
 * No logs, cookies or client bundles may contain the allowlist.
 */
export class BetaConfigurationError extends Error {
  constructor(){super('Restricted beta is not safely configured');this.name='BetaConfigurationError'}
}
export function readRestrictedBetaUsers(env={}){
  if(env.GWAP_BETA_MODE!=='restricted')throw new BetaConfigurationError();
  const raw=env.GWAP_BETA_ALLOWED_IDS;
  if(typeof raw!=='string'||!raw.trim())throw new BetaConfigurationError();
  const ids=raw.split(',').map(x=>x.trim());
  if(ids.length<1||ids.length>15||ids.some(x=>!(/^[1-9][0-9]{0,18}$/).test(x)))throw new BetaConfigurationError();
  const unique=new Set();
  for(const id of ids){
    let value;
    try {const bigint=BigInt(id);if(bigint>9223372036854775807n)throw new Error('out of range');value=bigint.toString();}
    catch {throw new BetaConfigurationError();}
    if(unique.has(value))throw new BetaConfigurationError();
    unique.add(value);
  }
  return unique;
}
export function betaUnavailable(res){
  res.statusCode=503;
  res.setHeader('Cache-Control','no-store, private');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.end(JSON.stringify({error:'beta_not_configured'}));
}
