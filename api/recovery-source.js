// Recovery branch ONLY. GET-only, read-only and no identity/secret values in responses.
// Never ship this diagnostic to the public game. Vercel protection remains required.
import { inspectRecoverySource } from "../server/recovery-source-inspection.mjs";
import { normalizePostgresSslMode } from "../server/postgres-tls.mjs";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end(JSON.stringify({status: "method_not_allowed"}));
    return;
  }
  const config = process.env.DATABASE_URL;
  const source = inspectRecoverySource(config);
  if (source !== "correct_isolated_source") {
    res.statusCode = 409;
    res.end(JSON.stringify({recoverySource: source, historicalDatasetVerified: false}));
    return;
  }
  let pool;
  try {
    const pg = await import("pg");
    const Pool = pg.Pool || pg.default?.Pool;
    pool = new Pool({connectionString: normalizePostgresSslMode(config), max: 1, connectionTimeoutMillis: 5000, idleTimeoutMillis: 5000, allowExitOnIdle: true});
    const result = await pool.query("SELECT (SELECT COUNT(*) FROM public.players) AS players, (SELECT COUNT(*) FROM public.quest_runs) AS quests, (SELECT COUNT(*) FROM public.virtual_ledger) AS ledger, (SELECT COUNT(*) FROM public.command_receipts) AS receipts");
    const x = result.rows[0] || {};
    const matches = Number(x.players) >= 2 && Number(x.quests) >= 5 && Number(x.ledger) >= 7 && Number(x.receipts) >= 27;
    res.statusCode = matches ? 200 : 409;
    res.end(JSON.stringify({recoverySource: "correct_isolated_source", historicalDatasetVerified: matches}));
  } catch {
    res.statusCode = 503;
    res.end(JSON.stringify({recoverySource: "correct_isolated_source", historicalDatasetVerified: false, status: "read_unavailable"}));
  } finally {
    if (pool) await pool.end().catch(() => {});
  }
}
