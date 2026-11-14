/**
 * Short-lived, signed, HttpOnly Telegram session cookies.
 * No tokens, credentials, or initData fields are persisted in browser storage.
 */
import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';

export const COOKIE_NAME='__Host-gwapoholics_session';
const MAX_AGE_SECONDS=60*60;
const MAX_FUTURE_SKEW=30;

function secretValue(secret){
 if(typeof secret!=='string'||Buffer.byteLength(secret,'utf8')<32)throw new Error('Session secret unavailable');
 return secret;
}
function userIdValue(uid){
 if(!/^[1-9][0-9]{0,18}$/.test(String(uid||'')))throw new Error('Invalid authenticated identity');
 const n=BigInt(uid);
 if(n>9223372036854775807n)throw new Error('Invalid authenticated identity');
 return String(n);
}
function mac(str,secret){
 return createHmac('sha256',secretValue(secret)).update(str).digest();
}
export function issueSessionCookie(uid,{secret,now=Date.now(),maxAge=MAX_AGE_SECONDS}={}){
 const userId=userIdValue(uid);
 const iat=Math.floor(now/1000);
 const payload=Buffer.from(JSON.stringify({uid:userId,iat,exp:iat+Math.min(maxAge,MAX_AGE_SECONDS),nonce:randomBytes(12).toString('hex')}),'utf8').toString('base64url');
 const token=payload+'.'+mac(payload,secret).toString('base64url');
 return COOKIE_NAME+'='+token+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+Math.min(maxAge,MAX_AGE_SECONDS);
}
export function parseSessionCookie(cookieHeader,{secret,previousSecret,now=Date.now()}={}){
 if(typeof cookieHeader!=='string'||cookieHeader.length>8192)return null;
 const matches=cookieHeader.split(';').map(x=>x.trim()).filter(x=>x.startsWith(COOKIE_NAME+'='));
 if(matches.length!==1)return null;
 const token=matches[0].slice(COOKIE_NAME.length+1);
 if(token.length>2048||!token.includes('.'))return null;
 const parts=token.split('.');
 if(parts.length!==2||!/^[A-Za-z0-9_-]+$/.test(parts[0])||!/^[A-Za-z0-9_-]+$/.test(parts[1]))return null;
 let supplied;try{supplied=Buffer.from(parts[1],'base64url');}catch{return null}
 const expected=mac(parts[0],secret);
 const validCurrent=supplied.length===expected.length&&timingSafeEqual(supplied,expected);
 // During rotation only, honor a previous signing key for existing
 // one-hour cookies. New cookies always use the current key.
 const oldMac=previousSecret?mac(parts[0],previousSecret):null;
 const validPrevious=oldMac&&supplied.length===oldMac.length&&timingSafeEqual(supplied,oldMac);
 if(!validCurrent&&!validPrevious)return null;
 try{
  const data=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
  const nowSeconds=Math.floor(now/1000);
  if(!Number.isSafeInteger(data.iat)||!Number.isSafeInteger(data.exp)||
    data.exp<=nowSeconds||data.iat>nowSeconds+MAX_FUTURE_SKEW||
    data.exp-data.iat>MAX_AGE_SECONDS||!data.nonce||!(/^[a-f0-9]{24}$/).test(data.nonce))return null;
  return Object.freeze({userId:userIdValue(data.uid),issuedAt:data.iat,expiresAt:data.exp});
 }catch{return null}
}
export function clearSessionCookie(){
 return COOKIE_NAME+'=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';
}
