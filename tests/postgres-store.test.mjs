import test from 'node:test';
import assert from 'node:assert/strict';
import {createPostgresStore} from '../server/postgres-store.mjs';

test('Postgres adapter writes player and ledger in a single committed transaction',async()=>{
 const seen=[];
 const pool={async connect(){return{
   async query(sql,params){
     seen.push([sql.trim().split(/\s+/).slice(0,4).join(' '),params]);
     if(sql.startsWith('SELECT game_state'))return{rows:[]};
     if(sql.startsWith('SELECT response'))return{rows:[]};
     return{rows:[]};
   },release(){seen.push(['release'])}
 }}};
 const result=await createPostgresStore(pool).transaction('1234',async tx=>{
  assert.equal(await tx.getGame(),null);
  await tx.setGame({balance:1000,seed:123,ledger:[{id:'welcome-1',type:'welcome',amount:1000,balanceAfter:1000}],played:[]});
  await tx.setReceipt('hello',{balance:1000},'a'.repeat(64));
  return {ok:true};
 });
 assert.deepEqual(result,{ok:true});
 assert.ok(seen.some(([sql])=>sql.includes('pg_advisory_xact_lock')));
 assert.ok(seen.some(([sql])=>sql==='COMMIT'));
 assert.ok(seen.some(([sql])=>sql.startsWith('INSERT INTO virtual_ledger')));
 assert.ok(seen.some(([sql])=>sql.startsWith('INSERT INTO command_receipts')));
 assert.equal(seen.at(-1)[0],'release');
});
test('Postgres adapter rolls back a failed command before releasing',async()=>{
 const seen=[];
 const pool={async connect(){return{
  async query(s){seen.push(s);return{rows:[]}},
  release(){seen.push('released')}
 }}};
 await assert.rejects(()=>createPostgresStore(pool).transaction('1234',()=>{throw Error('invalid action')}),/invalid/);
 assert.ok(seen.includes('ROLLBACK'));
 assert.ok(!seen.includes('COMMIT'));
 assert.equal(seen.at(-1),'released');
});
test('Rejects invalid player IDs before opening a connection',async()=>{
 const pool={connect(){throw Error('should not connect')}};
 await assert.rejects(()=>createPostgresStore(pool).transaction('not-id',()=>{}),/Invalid player ID/);
});
