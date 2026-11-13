import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {verifyTelegramInitData,TelegramInitDataError} from '../server/telegram-auth.mjs';
const BOT='TEST_ONLY_DO_NOT_DEPLOY_BOT_KEY_123456';
const NOW=1800000000000;
function signed(fields={}){
 const params=new URLSearchParams({
  user:JSON.stringify({id:1234567,first_name:'Founder',username:'testplayer'}),
  auth_date:String(Math.floor(NOW/1000)),query_id:'example-query',...fields
 });
 const check=[...params.entries()].map(([k,v])=>k+'='+v).sort().join('\n');
 const key=createHmac('sha256','WebAppData').update(BOT).digest();
 params.set('hash',createHmac('sha256',key).update(check).digest('hex'));
 return params.toString();
}
test('verifies signed fresh initData and identifies Telegram player',()=>{
 const data=verifyTelegramInitData(signed(),{botToken:BOT,now:NOW});
 assert.equal(data.userId,'1234567');assert.equal(data.profile.firstName,'Founder');
 assert.equal(data.queryId,'example-query');assert.equal('balance' in data,false);
});
test('rejects tampering and wrong token',()=>{
 assert.throws(()=>verifyTelegramInitData(signed().replace('1234567','9999999'),{botToken:BOT,now:NOW}),TelegramInitDataError);
 assert.throws(()=>verifyTelegramInitData(signed(),{botToken:BOT+'wrong',now:NOW}),TelegramInitDataError);
});
test('rejects expired and future claims',()=>{
 assert.throws(()=>verifyTelegramInitData(signed({auth_date:String(Math.floor(NOW/1000)-3601)}),{botToken:BOT,now:NOW}),/Expired/);
 assert.throws(()=>verifyTelegramInitData(signed({auth_date:String(Math.floor(NOW/1000)+31)}),{botToken:BOT,now:NOW}),/Expired/);
 assert.ok(verifyTelegramInitData(signed({auth_date:String(Math.floor(NOW/1000)-3599)}),{botToken:BOT,now:NOW}));
});
test('rejects malformed hash, duplicates, and missing or invalid users',()=>{
 const s=signed();
 assert.throws(()=>verifyTelegramInitData(s.replace(/&hash=[^&]*/,''),{botToken:BOT,now:NOW}),TelegramInitDataError);
 assert.throws(()=>verifyTelegramInitData(s+'&auth_date=1234567890',{botToken:BOT,now:NOW}),TelegramInitDataError);
 assert.throws(()=>verifyTelegramInitData(signed({user:'{"id":"oops"}'}),{botToken:BOT,now:NOW}),TelegramInitDataError);
 assert.throws(()=>verifyTelegramInitData(signed({user:'not json'}),{botToken:BOT,now:NOW}),TelegramInitDataError);
});
