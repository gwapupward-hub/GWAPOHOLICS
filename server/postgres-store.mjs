/**
 * PostgreSQL adapter for server-only game command service.
 * Database and schema are configured outside this repository.
 */
let liveStorePromise;
function safeUid(userId){
 if(!/^[1-9][0-9]{0,18}$/.test(String(userId||'')))throw new Error('Invalid player ID');
 const id=BigInt(userId);
 if(id>9223372036854775807n)throw new Error('Invalid player ID');
 return id.toString();
}
function ledgerType(type){
 if(type==='case')return 'quest_settlement';
 if(type==='welcome'||type==='recovery')return type;
 throw new Error('Unexpected virtual ledger event');
}
export function createPostgresStore(pool){
 if(!pool||typeof pool.connect!=='function')throw new Error('Database pool required');
 return {
  async transaction(userId,fn){
   const uid=safeUid(userId),client=await pool.connect();
   let began=false;
   try{
    await client.query('BEGIN');began=true;
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)',[uid]);
    let gameState,loaded=false;
    const tx={
     async getGame(){
      if(!loaded){
       const r=await client.query('SELECT game_state FROM players WHERE telegram_user_id=$1',[uid]);
       gameState=r.rows[0]?.game_state||null;
       loaded=true;
      }
      return gameState;
     },
     async setGame(game){
      if(!game||!Number.isSafeInteger(game.balance)||game.balance<0||!Number.isInteger(game.seed)){
       throw new Error('Invalid server game state');
      }
      const previous=await tx.getGame();
      await client.query(
       'INSERT INTO players (telegram_user_id,game_state,balance,seed,version,updated_at) '+
       'VALUES ($1,$2::jsonb,$3,$4,0,now()) '+
       'ON CONFLICT (telegram_user_id) DO UPDATE SET '+
       'game_state=EXCLUDED.game_state,balance=EXCLUDED.balance,seed=EXCLUDED.seed, '+
       'version=players.version+1,updated_at=now()',
        [uid,JSON.stringify(game),game.balance,game.seed]
      );
      const priorIds=new Set((previous?.ledger||[]).map(x=>x.id));
      const addedRuns=(game.played||[]).filter(x=>!(previous?.played||[]).some(y=>y.caseId===x.caseId));
      for(const run of addedRuns){
       await client.query(
        'INSERT INTO quest_runs (telegram_user_id,case_id,completed_at,choices) '+
        'VALUES ($1,$2,to_timestamp($3 / 1000.0),$4::jsonb)',
        [uid,run.caseId,run.at,JSON.stringify(run.path)]
       );
      }
      for(const e of game.ledger||[]){
       if(priorIds.has(e.id))continue;
       const type=ledgerType(e.type);
       const caseId=type==='quest_settlement'?addedRuns[0]?.caseId:null;
       if(type==='quest_settlement'&&!caseId)throw new Error('Missing settled mission');
       await client.query(
        'INSERT INTO virtual_ledger '+
        '(telegram_user_id,case_id,event_type,amount,balance_after,idempotency_key) '+
        'VALUES ($1,$2,$3,$4,$5,$6)',
         [uid,caseId,type,e.amount,e.balanceAfter,e.id]
       );
      }
      gameState=game;loaded=true;
     },
     async getReceipt(id,requestHash){
      const r=await client.query(
       'SELECT response,command_hash FROM command_receipts WHERE telegram_user_id=$1 AND idempotency_key=$2',
       [uid,id]
      );
      if(!r.rows.length)return null;
      if(r.rows[0].command_hash!==requestHash)throw new Error('requestId reused for another command');
      return r.rows[0].response;
     },
     async setReceipt(id,response,requestHash){
      await client.query(
       'INSERT INTO command_receipts (telegram_user_id,idempotency_key,command_hash,response) '+
       'VALUES ($1,$2,$3,$4::jsonb)',
       [uid,id,requestHash,JSON.stringify(response)]
      );
     }
    };
    const result=await fn(tx);
    await client.query('COMMIT');began=false;
    return result;
   }catch(err){
    if(began){try{await client.query('ROLLBACK')}catch{}}
    throw err;
   }finally{client.release()}
  }
 };
}
export async function getPostgresStore(){
 if(!process.env.DATABASE_URL)throw new Error('Database not configured');
 if(!liveStorePromise){
  liveStorePromise=(async()=>{
   const pg=await import('pg');
   const Pool=pg.Pool||pg.default?.Pool;
   const pool=new Pool({connectionString:process.env.DATABASE_URL,max:4,connectionTimeoutMillis:5000,idleTimeoutMillis:15000,allowExitOnIdle:true});
   return createPostgresStore(pool);
  })().catch(e=>{liveStorePromise=undefined;throw e});
 }
 return liveStorePromise;
}
