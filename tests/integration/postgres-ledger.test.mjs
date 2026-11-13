import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Pool} from 'pg';
import {CASES} from '../../cases.mjs';
import {createPostgresStore} from '../../server/postgres-store.mjs';
import {executeGameCommand} from '../../server/game-service.mjs';

const database=process.env.GWAPOHOLICS_TEST_DATABASE_URL;
test('real PostgreSQL: exactly-once settlement, atomic receipts, cross-instance restore', {skip:!database}, async()=>{
 const pool=new Pool({connectionString:database,max:8,connectionTimeoutMillis:5000});
 try{
  const migration=await readFile(new URL('../../server/sql/001_initial.sql',import.meta.url),'utf8');
  await pool.query(migration);
  // Only a *dedicated disposable CI database* is allowed in this test.
  const check=await pool.query('SELECT current_database() AS name');
  assert.equal(check.rows[0].name,'gwapoholics_ci');
  await pool.query('TRUNCATE virtual_ledger,command_receipts,quest_runs,players RESTART IDENTITY CASCADE');
  const store=createPostgresStore(pool);
  const uid='1414141414';
  const now=1800000000000;
  const snapshot=await executeGameCommand({store,userId:uid,command:'snapshot',now});
  assert.equal(snapshot.balance,1000);
  assert.equal(snapshot.completed.length,0);
  const quest=CASES.find(x=>x.id==='streaming-pivot');
  const started=await executeGameCommand({
    store,userId:uid,command:'start',caseId:quest.id,requestId:'begin-1',now
  });
  assert.equal(started.draft.caseId,quest.id);
  assert.equal(started.draft.round,0);

  for(let i=0;i<3;i++){
    const state=await executeGameCommand({
      store,userId:uid,command:'choose',caseId:quest.id,
      choiceId:quest.stages[i].options[0].id,requestId:'step-'+i,now:now+i
    });
    assert.equal(state.draft.round,i+1);
    assert.equal(state.completed.length,0);
  }
  const final={
    store,userId:uid,command:'choose',caseId:quest.id,
    choiceId:quest.stages[3].options[0].id,requestId:'final-choice',now:now+4000
  };
  const [a,b,c]=await Promise.all([
    executeGameCommand(final),
    executeGameCommand({...final}),
    executeGameCommand({...final})
  ]);
  assert.deepEqual(a,b);
  assert.deepEqual(b,c);
  assert.equal(a.completed.length,1);
  assert.ok(Number.isInteger(a.balance));
  const counts=await pool.query(
    'SELECT (SELECT count(*)::int FROM quest_runs WHERE telegram_user_id=$1) AS runs, '+
    '(SELECT count(*)::int FROM virtual_ledger WHERE telegram_user_id=$1 AND event_type=$2) AS payouts, '+
    '(SELECT count(*)::int FROM command_receipts WHERE telegram_user_id=$1) AS receipts',
    [uid,'quest_settlement']
  );
  assert.deepEqual(counts.rows[0],{runs:1,payouts:1,receipts:5});
  await assert.rejects(
    ()=>executeGameCommand({
      ...final,requestId:'new-request-id'
    }),/Start this scenario first|already completed/
  );
  await assert.rejects(
    ()=>executeGameCommand({
      ...final,choiceId:quest.stages[3].options[1].id
    }),/requestId reused/
  );

  // Fresh pool means a new server instance/device. There must be no reliance
  // on in-memory state, localStorage or the first process's pool.
  const second=new Pool({connectionString:database,max:2});
  try{
    const resumed=await executeGameCommand({
      store:createPostgresStore(second),userId:uid,command:'snapshot',now:now+5000
    });
    assert.equal(resumed.balance,a.balance);
    assert.equal(resumed.completed.length,1);
    assert.equal(resumed.completed[0].caseId,quest.id);
    assert.equal('seed' in resumed,false);
    assert.equal('delta' in resumed.evidence,false);
  }finally{await second.end()}

  const stranger=await executeGameCommand({
    store,userId:'2424242424',command:'snapshot',now
  });
  assert.equal(stranger.balance,1000);
  assert.equal(stranger.completed.length,0);
  const finalCounts=await pool.query('SELECT count(*)::int AS players FROM players');
  assert.equal(finalCounts.rows[0].players,2);
 }finally{await pool.end()}
});
