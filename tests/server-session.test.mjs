import test from 'node:test';
import assert from 'node:assert/strict';
import {COOKIE_NAME,issueSessionCookie,parseSessionCookie,clearSessionCookie} from '../server/session.mjs';
const SECRET='a'.repeat(48),NOW=1800000000000;
test('secure HttpOnly session encodes a validated identity without exposing token or initData',()=>{
 const c=issueSessionCookie('1234567',{secret:SECRET,now:NOW});
 assert.ok(c.startsWith(COOKIE_NAME+'='));
 assert.match(c,/HttpOnly; Secure; SameSite=Strict/);
 assert.doesNotMatch(c,/initData|BotFather/);
 const v=parseSessionCookie(c.split(';')[0],{secret:SECRET,now:NOW+30000});
 assert.equal(v.userId,'1234567');
 assert.equal('token' in v,false);
});
test('expired, forged, repeated and invalid session cookies are denied',()=>{
 const c=issueSessionCookie('1234567',{secret:SECRET,now:NOW}).split(';')[0];
 assert.equal(parseSessionCookie(c,{secret:SECRET,now:NOW+3600000}),null);
 assert.equal(parseSessionCookie(c,{secret:'x'.repeat(48),now:NOW}),null);
 assert.equal(parseSessionCookie(c+'; '+c,{secret:SECRET,now:NOW}),null);
 assert.equal(parseSessionCookie(c.replace(/[A-Za-z0-9_-](?=\.)/,'x'),{secret:SECRET,now:NOW}),null);
 assert.equal(parseSessionCookie('',{secret:SECRET,now:NOW}),null);
 assert.match(clearSessionCookie(),/Max-Age=0/);
});
test('rotated signing key accepts old cookies only within their original lifetime',()=>{
 const old=issueSessionCookie('1234567',{secret:SECRET,now:NOW}).split(';')[0];
 const next='b'.repeat(48);
 assert.equal(parseSessionCookie(old,{secret:next,now:NOW}),null);
 assert.equal(parseSessionCookie(old,{secret:next,previousSecret:SECRET,now:NOW+1000}).userId,'1234567');
 assert.equal(parseSessionCookie(old,{secret:next,previousSecret:SECRET,now:NOW+3600000}),null);
 const fresh=issueSessionCookie('1234567',{secret:next,now:NOW}).split(';')[0];
 assert.equal(parseSessionCookie(fresh,{secret:next,now:NOW}).userId,'1234567');
});
test('a secret shorter than 32 bytes is unusable',()=>{
 assert.throws(()=>issueSessionCookie('1234567',{secret:'short',now:NOW}),/unavailable/);
});
