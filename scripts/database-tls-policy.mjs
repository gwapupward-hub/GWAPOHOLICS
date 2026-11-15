/**
 * Inspects only the connection's TLS policy. Never returns credentials or hosts.
 * This is a diagnostic; it does not modify the connection string.
 */
export function inspectDatabaseTls(connectionString){
 if(!connectionString)return {status:'missing',sslMode:'unknown',action:'Configure DATABASE_URL'};
 let url;
 try{url=new URL(connectionString)}catch{return {status:'invalid',sslMode:'unknown',action:'Review DATABASE_URL privately'}}
 if(!['postgres:','postgresql:'].includes(url.protocol))return {status:'invalid',sslMode:'unknown',action:'Expected PostgreSQL URL'};
 const mode=url.searchParams.get('sslmode');
 if(mode==='verify-full')return {status:'explicit-verified',sslMode:'verify-full',action:'Confirm connection succeeds on Preview'};
 if(['require','prefer','verify-ca'].includes(mode))return {status:'legacy-alias',sslMode:mode,action:'Verify Neon certificate support, then use sslmode=verify-full in scoped Preview secret'};
 if(mode==='disable'||mode==='allow')return {status:'unsafe',sslMode:mode,action:'Require certificate and hostname verification'};
 return {status:'unconfirmed',sslMode:mode??'unspecified',action:'Inspect provider TLS settings and verify hostname checking'};
}
