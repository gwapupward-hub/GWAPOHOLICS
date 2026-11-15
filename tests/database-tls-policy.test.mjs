import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectDatabaseTls} from '../scripts/database-tls-policy.mjs';

const url=(mode)=>'postgresql://secret-user:secret-password@private.example:5432/database'+(mode===null?'':'?sslmode='+mode);
test('explicit verify-full passes without leaking URL',()=>{
 const r=inspectDatabaseTls(url('verify-full'));
 assert.equal(r.status,'explicit-verified');
 assert.ok(!JSON.stringify(r).includes('secret-password'));
 assert.ok(!JSON.stringify(r).includes('private.example'));
});
test('legacy modes require review',()=>{
 for(const mode of ['require','prefer','verify-ca'])assert.equal(inspectDatabaseTls(url(mode)).status,'legacy-alias');
});
test('weak and missing modes cannot pass',()=>{
 for(const mode of ['disable','allow'])assert.equal(inspectDatabaseTls(url(mode)).status,'unsafe');
 assert.equal(inspectDatabaseTls(url(null)).status,'unconfirmed');
 assert.equal(inspectDatabaseTls('invalid').status,'invalid');
 assert.equal(inspectDatabaseTls('').status,'missing');
});
