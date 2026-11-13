/**
 * Read-only verification of a provisioned GWAPOHOLICS Preview Postgres DB.
 * Does NOT create, alter or delete tables. Run only after provisioning.
 */
const connection=process.env.DATABASE_URL;
if(!connection){console.error('DATABASE_URL is not configured; no database was inspected.');process.exitCode=2;}
else{
 const pg=await import('pg'),Pool=pg.Pool||pg.default?.Pool;
 const pool=new Pool({connectionString:connection,max:1,connectionTimeoutMillis:7000});
 try{
  const c=await pool.connect();
  try{
   const tables=await c.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename = ANY($1::text[])",
    [['players','quest_runs','command_receipts','virtual_ledger']]
   );
   const found=new Set(tables.rows.map(x=>x.tablename));
   const expected=['players','quest_runs','command_receipts','virtual_ledger'];
   if(expected.some(x=>!found.has(x))){
    console.error('Missing required GWAPOHOLICS schema tables: '+expected.filter(x=>!found.has(x)).join(', '));
    process.exitCode=1;
   }else{
    const constraints=await c.query(
     "SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='virtual_ledger'"
    );
    const names=new Set(constraints.rows.map(x=>x.indexname));
    if(!names.has('one_settlement_per_player_case')){
      console.error('Missing per-player, per-case settlement uniqueness index');process.exitCode=1;
    }else console.log('GWAPOHOLICS Preview database schema: present and settlement uniqueness index verified.');
   }
  }finally{c.release()}
 }catch{
  console.error('Could not connect or inspect the Preview database. Credentials were not logged.');
  process.exitCode=2;
 }finally{await pool.end()}
}
