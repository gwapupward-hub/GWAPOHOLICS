/**
 * PostgreSQL adapter for the v2 Founder service (migration 002).
 *
 * Every transaction first takes a per-Telegram-identity advisory lock, so two
 * requests for the same player (retries, concurrent logins, two devices, two
 * Vercel instances) run strictly one after another. Database constraints
 * (UNIQUE run settlement, UNIQUE ledger idempotency key, append-only triggers)
 * are the second line of defence if application logic is ever wrong.
 */
import { FounderError } from "./origin-engine.mjs";

const DEFAULT_BUDGET = Object.freeze({ limit: 30, windowSeconds: 60 });

function safeUid(userId) {
  if (!/^[1-9][0-9]{0,18}$/.test(String(userId || ""))) throw new Error("Invalid player ID");
  const id = BigInt(userId);
  if (id > 9223372036854775807n) throw new Error("Invalid player ID");
  return id.toString();
}
// Exact epoch-millisecond conversions (no float rounding).
const TS = (n) => `('epoch'::timestamptz + ($${n}::bigint * interval '1 millisecond'))`;
const MS = (col, alias) => `(floor(extract(epoch from ${col}) * 1000))::bigint AS ${alias}`;
const num = (v) => (v === null || v === undefined ? null : Number(v));

export function createPostgresFounderStore(pool, { commandBudget = DEFAULT_BUDGET } = {}) {
  if (!pool || typeof pool.connect !== "function") throw new Error("Database pool required");
  return {
    async transaction(telegramUserId, fn) {
      const uid = safeUid(telegramUserId);
      const client = await pool.connect();
      let began = false;
      const q = (text, params) => client.query(text, params);
      try {
        await q("BEGIN");
        began = true;
        await q("SELECT pg_advisory_xact_lock(hashtextextended('gwap:v2:founder:' || $1::text, 0))", [uid]);

        const tx = {
          async hasLegacyV1Player() {
            const r = await q("SELECT 1 FROM players WHERE telegram_user_id = $1::bigint", [uid]);
            return r.rowCount > 0;
          },
          async findFounder() {
            const r = await q(
              `SELECT f.founder_id, f.cohort_kind, f.session_ordinal, ${MS("f.last_seen_at", "last_seen")},
                      ${MS("f.entered_v2_at", "entered")}, ${MS("f.created_at", "created")}
                 FROM v2_founder_telegram_accounts a JOIN v2_founders f USING (founder_id)
                WHERE a.telegram_user_id = $1::bigint`, [uid]);
            const row = r.rows[0];
            return row ? {
              founderId: row.founder_id, cohortKind: row.cohort_kind, sessionOrdinal: row.session_ordinal,
              lastSeenAt: num(row.last_seen), enteredV2At: num(row.entered), createdAt: num(row.created)
            } : null;
          },
          async createFounder({ founderId, cohortKind, now }) {
            await q(
              `INSERT INTO v2_founders (founder_id, cohort_kind, session_ordinal, last_seen_at, created_at, updated_at)
               VALUES ($1, $2, 1, ${TS(3)}, ${TS(3)}, ${TS(3)})`, [founderId, cohortKind, now]);
            await q(`INSERT INTO v2_founder_telegram_accounts (telegram_user_id, founder_id, linked_at)
                     VALUES ($1::bigint, $2, ${TS(3)})`, [uid, founderId, now]);
            await q(`INSERT INTO v2_origin_qualification (founder_id, updated_at) VALUES ($1, ${TS(2)})`, [founderId, now]);
            await q(`INSERT INTO v2_capital_accounts (founder_id, updated_at) VALUES ($1, ${TS(2)})`, [founderId, now]);
            return { founderId, cohortKind, sessionOrdinal: 1, lastSeenAt: now, enteredV2At: null, createdAt: now };
          },
          async touchFounder({ founderId, sessionOrdinal, lastSeenAt, now }) {
            await q(`UPDATE v2_founders SET session_ordinal = $2, last_seen_at = ${TS(3)}, updated_at = ${TS(4)} WHERE founder_id = $1`,
              [founderId, sessionOrdinal, lastSeenAt, now]);
          },
          async markEnteredV2({ founderId, now }) {
            const r = await q(`UPDATE v2_founders SET entered_v2_at = ${TS(2)}, updated_at = ${TS(2)}
                                WHERE founder_id = $1 AND entered_v2_at IS NULL`, [founderId, now]);
            if (r.rowCount !== 1) throw new Error("Founder hub entry not recorded");
          },
          async getQualification(founderId) {
            const r = await q(
              `SELECT best_score_g, total_credited_g, best_run_id, finalized_runs, revision, ${MS("graduated_at", "graduated")}
                 FROM v2_origin_qualification WHERE founder_id = $1`, [founderId]);
            const row = r.rows[0];
            if (!row) throw new Error("Missing qualification record");
            return {
              bestScoreG: row.best_score_g, totalCreditedG: num(row.total_credited_g), bestRunId: row.best_run_id,
              finalizedRuns: row.finalized_runs, graduatedAt: num(row.graduated), revision: num(row.revision)
            };
          },
          async getCapital(founderId) {
            const r = await q("SELECT balance_g FROM v2_capital_accounts WHERE founder_id = $1", [founderId]);
            if (!r.rows[0]) throw new Error("Missing capital account");
            return { balanceG: num(r.rows[0].balance_g) };
          },
          async getBusiness(founderId) {
            const result = await q(`SELECT b.business_id, b.business_type_id, b.template_version, b.lifecycle_status,
                s.decision_id, s.choice_id, s.policy_version, d.transaction_id, d.amount_g, d.reserve_g, d.balance_after_g, ${MS("d.occurred_at","opened")}
              FROM v2_businesses b JOIN v2_capital_debit_ledger d USING (business_id)
              JOIN v2_founder_decisions s USING (business_id)
              WHERE b.owner_founder_id=$1`, [founderId]);
            const row = result.rows[0];
            return row ? {
              businessId: row.business_id, businessTypeId: row.business_type_id, version: row.template_version,
              decision: { id: row.decision_id, version: row.policy_version, choiceId: row.choice_id },
              status: row.lifecycle_status, transactionId: row.transaction_id, setupCostG: num(row.amount_g),
              minimumOperatingReserveG: num(row.reserve_g), balanceAfterG: num(row.balance_after_g), openedAt: num(row.opened)
            } : null;
          },
          async openFirstBusiness({ founderId, businessId, offer, transactionId, decision, now }) {
            const { setupCostG, minimumOperatingReserveG } = offer;
            const debit = await q(`UPDATE v2_capital_accounts SET balance_g=balance_g-$2::bigint,
                revision=revision+1, updated_at=${TS(4)}
              WHERE founder_id=$1 AND balance_g >= $2::bigint+$3::bigint RETURNING balance_g`,
              [founderId, setupCostG, minimumOperatingReserveG, now]);
            if (!debit.rowCount) throw new FounderError("insufficient_capital", "Capital below setup plus reserve", 409);
            await q(`INSERT INTO v2_businesses (business_id,owner_founder_id,business_type_id,template_version,lifecycle_status,created_at)
              VALUES ($1,$2,$3,$4,'operating',${TS(5)})`, [businessId, founderId, offer.businessTypeId, offer.version, now]);
            await q(`INSERT INTO v2_capital_debit_ledger
              (transaction_id,business_id,founder_id,amount_g,reserve_g,balance_after_g,idempotency_key,occurred_at)
              VALUES ($1,$2,$3,$4,$5,$6,$7,${TS(8)})`,
              [transactionId, businessId, founderId, setupCostG, minimumOperatingReserveG, debit.rows[0].balance_g, "open:"+businessId, now]);
            await q(`INSERT INTO v2_founder_decisions (decision_id,business_id,founder_id,policy_version,choice_id,occurred_at)
              VALUES ($1,$2,$3,$4,$5,${TS(6)})`, [decision.id, businessId, founderId, decision.version, decision.choiceId, now]);
          },
          async getOpenRun(founderId) {
            const r = await q(
              `SELECT origin_run_id, run_number, policy_version, seed, draft, ${MS("started_at", "started")}
                 FROM v2_origin_runs WHERE founder_id = $1 AND status = 'in_progress'`, [founderId]);
            const row = r.rows[0];
            return row ? {
              originRunId: row.origin_run_id, runNumber: row.run_number, policyVersion: row.policy_version,
              seed: num(row.seed), draft: row.draft, startedAt: num(row.started), status: "in_progress"
            } : null;
          },
          async createRun({ founderId, originRunId, policyVersion, seed, now }) {
            const r = await q(
              `INSERT INTO v2_origin_runs (origin_run_id, founder_id, run_number, policy_version, seed, status, started_at)
               SELECT $1, $2, COALESCE(max(run_number), 0) + 1, $3, $4::bigint, 'in_progress', ${TS(5)}
                 FROM v2_origin_runs WHERE founder_id = $2
               RETURNING run_number`, [originRunId, founderId, policyVersion, seed, now]);
            return { originRunId, runNumber: r.rows[0].run_number, policyVersion, seed, draft: null, startedAt: now, status: "in_progress" };
          },
          async setDraft({ founderId, originRunId, draft }) {
            const r = await q(
              `UPDATE v2_origin_runs SET draft = $3::jsonb
                WHERE origin_run_id = $1 AND founder_id = $2 AND status = 'in_progress'`,
              [originRunId, founderId, draft === null ? null : JSON.stringify(draft)]);
            if (r.rowCount !== 1) throw new Error("Open Origin run not found");
          },
          async getRunResults({ founderId, originRunId }) {
            const r = await q(
              `SELECT case_id, path, raw_delta, band, quest_score_g, ${MS("completed_at", "completed")}
                 FROM v2_origin_quest_results WHERE origin_run_id = $1 AND founder_id = $2
                ORDER BY completed_at, case_id`, [originRunId, founderId]);
            return r.rows.map((x) => ({
              caseId: x.case_id, path: x.path, rawDelta: x.raw_delta, band: x.band,
              questScoreG: x.quest_score_g, completedAt: num(x.completed)
            }));
          },
          async insertQuestResult({ originRunId, founderId, caseId, path, rawDelta, band, questScoreG, completedAt }) {
            await q(
              `INSERT INTO v2_origin_quest_results (origin_run_id, founder_id, case_id, path, raw_delta, band, quest_score_g, completed_at)
               VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, ${TS(8)})`,
              [originRunId, founderId, caseId, JSON.stringify(path), rawDelta, band, questScoreG, completedAt]);
          },
          async finalizeRun({ founderId, originRunId, verifiedScoreG, finalizedAt }) {
            const r = await q(
              `UPDATE v2_origin_runs SET status = 'finalized', draft = NULL, verified_score_g = $3, finalized_at = ${TS(4)}
                WHERE origin_run_id = $1 AND founder_id = $2 AND status = 'in_progress'`,
              [originRunId, founderId, verifiedScoreG, finalizedAt]);
            if (r.rowCount !== 1) throw new Error("Origin run could not be finalized");
          },
          async creditCapital({ founderId, deltaG, now }) {
            const r = await q(
              `UPDATE v2_capital_accounts SET balance_g = balance_g + $2, revision = revision + 1, updated_at = ${TS(3)}
                WHERE founder_id = $1 RETURNING balance_g`, [founderId, deltaG, now]);
            if (r.rowCount !== 1) throw new Error("Capital account not found");
            return num(r.rows[0].balance_g);
          },
          async insertCapitalCredit(c) {
            await q(
              `INSERT INTO v2_capital_credit_ledger
                 (transaction_id, founder_id, origin_run_id, verified_score_g, previous_best_g, credit_delta_g,
                  best_after_g, balance_after_g, policy_version, idempotency_key, occurred_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, ${TS(11)})`,
              [c.transactionId, c.founderId, c.originRunId, c.verifiedScoreG, c.previousBestG, c.creditDeltaG,
                c.bestAfterG, c.balanceAfterG, c.policyVersion, c.idempotencyKey, c.occurredAt]);
          },
          async insertSettlement(s) {
            await q(
              `INSERT INTO v2_origin_settlements
                 (origin_run_id, founder_id, verified_score_g, previous_best_g, credit_delta_g, best_after_g,
                  outcome, transaction_id, policy_version, idempotency_key, settled_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, ${TS(11)})`,
              [s.originRunId, s.founderId, s.verifiedScoreG, s.previousBestG, s.creditDeltaG, s.bestAfterG,
                s.outcome, s.transactionId, s.policyVersion, s.idempotencyKey, s.settledAt]);
          },
          async recordFinalization({ founderId, bestScoreG, creditDeltaG, bestRunId, graduatedAt, now }) {
            const r = await q(
              `UPDATE v2_origin_qualification
                  SET best_score_g = $2, total_credited_g = total_credited_g + $3,
                      best_run_id = COALESCE($4, best_run_id), finalized_runs = finalized_runs + 1,
                      graduated_at = COALESCE(graduated_at, ${TS(5)}), revision = revision + 1, updated_at = ${TS(6)}
                WHERE founder_id = $1`, [founderId, bestScoreG, creditDeltaG, bestRunId, graduatedAt, now]);
            if (r.rowCount !== 1) throw new Error("Qualification record not found");
          },
          async addReputationEvent(e) {
            await q(
              `INSERT INTO v2_reputation_events
                 (event_id, founder_id, event_type, dimension, schema_version, policy_version, subject_ref, payload,
                  evidence_digest, dedupe_key, corrects_event_id, occurred_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, ${TS(12)})`,
              [e.eventId, e.founderId, e.type, e.dimension, e.schemaVersion, e.policyVersion, e.subjectRef,
                JSON.stringify(e.payload), e.evidenceDigest, e.dedupeKey, e.correctsEventId, e.occurredAt]);
          },
          async addTelemetryEvent(e) {
            const r = await q(
              `INSERT INTO v2_telemetry_events
                 (event_id, event_name, schema_version, analytics_key, occurred_at, occurred_on, cohort_day, cohort_kind,
                  source_ref, properties, dedupe_key)
               VALUES ($1, $2, $3, $4, ${TS(5)}, $6::date, $7::date, $8, $9, $10::jsonb, $11)
               ON CONFLICT (dedupe_key) DO NOTHING`,
              [e.eventId, e.eventName, e.schemaVersion, e.analyticsKey, e.occurredAt, e.occurredOn, e.cohortDay,
                e.cohortKind, e.sourceRef, JSON.stringify(e.properties), e.dedupeKey]);
            return r.rowCount === 1;
          },
          async getLatestRun(founderId) {
            const r = await q(
              `SELECT origin_run_id, run_number, policy_version, seed, status, draft, verified_score_g,
                      ${MS("started_at", "started")}, ${MS("finalized_at", "finalized")}
                 FROM v2_origin_runs WHERE founder_id = $1
                ORDER BY (status = 'in_progress') DESC, run_number DESC LIMIT 1`, [founderId]);
            const row = r.rows[0];
            if (!row) return null;
            const run = {
              originRunId: row.origin_run_id, runNumber: row.run_number, policyVersion: row.policy_version,
              seed: num(row.seed), status: row.status, draft: row.draft, verifiedScoreG: row.verified_score_g,
              startedAt: num(row.started), finalizedAt: num(row.finalized)
            };
            return { run, results: await tx.getRunResults({ founderId, originRunId: run.originRunId }) };
          },
          async listSettlements(founderId, limit) {
            const r = await q(
              `SELECT r.run_number, s.verified_score_g, s.previous_best_g, s.credit_delta_g, s.best_after_g, s.outcome,
                      s.transaction_id, s.policy_version, ${MS("s.settled_at", "settled")}
                 FROM v2_origin_settlements s JOIN v2_origin_runs r USING (origin_run_id)
                WHERE s.founder_id = $1 ORDER BY r.run_number DESC LIMIT $2`, [founderId, limit]);
            return r.rows.map((x) => ({
              runNumber: x.run_number, verifiedScoreG: x.verified_score_g, previousBestG: x.previous_best_g,
              creditDeltaG: x.credit_delta_g, bestAfterG: x.best_after_g, outcome: x.outcome,
              transactionId: x.transaction_id, policyVersion: x.policy_version, settledAt: num(x.settled)
            }));
          },
          async getReceipt(id, requestHash) {
            const r = await q(
              "SELECT response, command_hash FROM v2_command_receipts WHERE telegram_user_id = $1::bigint AND idempotency_key = $2",
              [uid, id]);
            if (!r.rows.length) return null;
            if (r.rows[0].command_hash !== requestHash) throw new FounderError("request_id_conflict", "requestId reused for another command", 409);
            return r.rows[0].response;
          },
          async setReceipt(id, response, requestHash) {
            const budget = await q(
              `SELECT count(*)::int AS count FROM v2_command_receipts
                WHERE telegram_user_id = $1::bigint AND created_at > now() - make_interval(secs => $2)`,
              [uid, commandBudget.windowSeconds]);
            if (Number(budget.rows[0]?.count || 0) >= commandBudget.limit) {
              throw new FounderError("rate_limited", "Command rate limit exceeded", 429);
            }
            await q(
              `INSERT INTO v2_command_receipts (telegram_user_id, idempotency_key, command_hash, response)
               VALUES ($1::bigint, $2, $3, $4::jsonb)`, [uid, id, requestHash, JSON.stringify(response)]);
          }
        };
        const result = await fn(tx);
        await q("COMMIT");
        began = false;
        return result;
      } catch (error) {
        if (began) { try { await q("ROLLBACK"); } catch { /* connection already failed */ } }
        throw error;
      } finally {
        client.release();
      }
    }
  };
}

let livePromise;
/** Lazily builds the pooled store from DATABASE_URL (same pool settings as v1). */
export async function getPostgresFounderStore() {
  if (!process.env.DATABASE_URL) throw new Error("Database not configured");
  if (!livePromise) {
    livePromise = (async () => {
      const [{ normalizePostgresSslMode }, pg] = await Promise.all([import("../postgres-tls.mjs"), import("pg")]);
      const Pool = pg.Pool || pg.default?.Pool;
      const pool = new Pool({ connectionString: normalizePostgresSslMode(process.env.DATABASE_URL), max: 4, connectionTimeoutMillis: 5000, idleTimeoutMillis: 15000, allowExitOnIdle: true });
      return createPostgresFounderStore(pool);
    })().catch((error) => { livePromise = undefined; throw error; });
  }
  return livePromise;
}
