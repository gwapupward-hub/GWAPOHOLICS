import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePostgresSslMode} from '../server/postgres-tls.mjs';

test('legacy pg SSL aliases retain verify-full hostname verification',()=>{
 for(const mode of ['prefer','require','verify-ca']){
  const original='postgresql://some%40user:s%3Acret%23value@private.neon.tech/neondb?sslmode='+mode+'&channel_binding=require&options=-c%20statement_timeout%3D5000';
  const result=normalizePostgresSslMode(original);
  const parsed=new URL(result);
  const prior=new URL(original);
  assert.equal(parsed.searchParams.get('sslmode'),'verify-full');
  assert.equal(parsed.username,prior.username);
  assert.equal(parsed.password,prior.password);
  assert.equal(parsed.host,prior.host);
  assert.equal(parsed.pathname,prior.pathname);
  assert.equal(parsed.searchParams.get('channel_binding'),'require');
  assert.equal(parsed.searchParams.get('options'),'-c statement_timeout=5000');
  assert.ok(!result.includes('sslmode='+mode));
 }
});

test('already verified and other modes are not rewritten',()=>{
 for(const mode of ['verify-full','disable','allow','verify-ca-misspelled']){
  const original='postgres://hidden:secret@private.neon.tech/neondb?sslmode='+mode+'&x=1';
  assert.equal(normalizePostgresSslMode(original),original);
 }
});

test('missing, malformed, or non-postgres connection strings are passed through',()=>{
 for(const value of [undefined,'','not-a-url','https://example.com?sslmode=require','postgresql://x@y/z?some=value']){
  assert.equal(normalizePostgresSslMode(value),value);
 }
});
