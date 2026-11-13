/** Server-only Telegram WebApp initData authentication.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * Never import in the browser or expose the bot token.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
export class TelegramInitDataError extends Error {
  constructor(message){super(message);this.name='TelegramInitDataError';}
}
export function verifyTelegramInitData(raw,{botToken,now=Date.now(),maxAgeSeconds=3600,futureSkewSeconds=30}={}){
  if(typeof raw!=='string'||raw.length<15||raw.length>16384) throw new TelegramInitDataError('Invalid initData');
  if(typeof botToken!=='string'||botToken.length<10) throw new TelegramInitDataError('Bot token not configured');
  const params=new URLSearchParams(raw);
  const pairs=[...params.entries()];
  if(pairs.length<3||pairs.length>60) throw new TelegramInitDataError('Invalid field count');
  if(new Set(pairs.map(([key])=>key)).size!==pairs.length) throw new TelegramInitDataError('Duplicate initData fields');
  const hash=params.get('hash');
  if(!hash||!/^[a-fA-F0-9]{64}$/.test(hash)) throw new TelegramInitDataError('Missing or malformed hash');
  const dataCheck=pairs.filter(([key])=>key!=='hash').map(([key,value])=>key+'='+value).sort().join('\n');
  const secret=createHmac('sha256','WebAppData').update(botToken).digest();
  const expected=createHmac('sha256',secret).update(dataCheck).digest();
  const received=Buffer.from(hash,'hex');
  if(received.length!==expected.length||!timingSafeEqual(received,expected)) throw new TelegramInitDataError('Invalid Telegram signature');
  const authDate=params.get('auth_date');
  if(!authDate||!/^\d{10,13}$/.test(authDate)) throw new TelegramInitDataError('Invalid auth_date');
  const issued=Number(authDate), nowSeconds=Math.floor(Number(now)/1000);
  if(!Number.isSafeInteger(nowSeconds)||!Number.isSafeInteger(issued)||issued>nowSeconds+futureSkewSeconds||nowSeconds-issued>maxAgeSeconds)
    throw new TelegramInitDataError('Expired or future initData');
  let user;
  try{user=JSON.parse(params.get('user')||'null');}
  catch{throw new TelegramInitDataError('Invalid Telegram user');}
  if(!user||!Number.isSafeInteger(user.id)||user.id<=0) throw new TelegramInitDataError('Invalid Telegram user');
  return Object.freeze({
    userId:String(user.id),issuedAt:issued,queryId:params.get('query_id')||null,
    profile:Object.freeze({
      firstName:typeof user.first_name==='string'?user.first_name.slice(0,128):null,
      username:typeof user.username==='string'?user.username.slice(0,64):null
    })
  });
}
