// TEST SUPPORT ONLY. A transactional in-memory twin of server/v2/postgres-founder-store.mjs.
// It emulates the migration's uniqueness / immutability rules so service logic can be tested
// without a database. Real-database behaviour is proven in tests/integration/postgres-founder.test.mjs.
import { FounderError } from "../../server/v2/origin-engine.mjs";

function violation(name) { return Object.assign(new Error(`duplicate key value violates unique constraint "${name}"`), { code: "23505" }); }

export function createMemoryFounderStore({ commandBudget = { limit: 30, windowSeconds: 60 }, clock = () => Date.now() } = {}) {
  let db = {
    founders: new Map(), tgAccounts: new Map(), runs: new Map(), quests: [], qualification: new Map(), capital: new Map(),
    ledger: [], settlements: [], reputation: [], telemetry: [], receipts: new Map(), legacyPlayers: new Set()
  };
  let queue = Promise.resolve();
  const copy = (v) => structuredClone(v);

  return {
    get db() { return db; },
    addLegacyPlayer(telegramUserId) { db.legacyPlayers.add(String(telegramUserId)); },
    transaction(telegramUserId, fn) {
      const uid = String(telegramUserId);
      const job = queue.then(async () => {
        const backup = copy(db);
        const founderIdOf = () => db.tgAccounts.get(uid) ?? null;
        const tx = {
          async hasLegacyV1Player() { return db.legacyPlayers.has(uid); },
          async findFounder() { const id = founderIdOf(); return id ? copy(db.founders.get(id)) : null; },
          async createFounder({ founderId, cohortKind, now }) {
            if (db.tgAccounts.has(uid)) throw violation("v2_founder_telegram_accounts_pkey");
            const founder = { founderId, cohortKind, sessionOrdinal: 1, lastSeenAt: now, enteredV2At: null, createdAt: now };
            db.founders.set(founderId, founder);
            db.tgAccounts.set(uid, founderId);
            db.qualification.set(founderId, { bestScoreG: 0, totalCreditedG: 0, bestRunId: null, finalizedRuns: 0, graduatedAt: null, revision: 0 });
            db.capital.set(founderId, { balanceG: 0 });
            return copy(founder);
          },
          async touchFounder({ founderId, sessionOrdinal, lastSeenAt }) { Object.assign(db.founders.get(founderId), { sessionOrdinal, lastSeenAt }); },
          async markEnteredV2({ founderId, now }) {
            const f = db.founders.get(founderId);
            if (f.enteredV2At !== null) throw new Error("Founder hub entry not recorded");
            f.enteredV2At = now;
          },
          async getQualification(founderId) { return copy(db.qualification.get(founderId)); },
          async getCapital(founderId) { return copy(db.capital.get(founderId)); },
          async getOpenRun(founderId) {
            const run = [...db.runs.values()].find((r) => r.founderId === founderId && r.status === "in_progress");
            return run ? copy(run) : null;
          },
          async createRun({ founderId, originRunId, policyVersion, seed, now }) {
            const mine = [...db.runs.values()].filter((r) => r.founderId === founderId);
            if (mine.some((r) => r.status === "in_progress")) throw violation("v2_one_open_origin_run_per_founder");
            const run = { originRunId, founderId, runNumber: mine.length + 1, policyVersion, seed, draft: null, startedAt: now, status: "in_progress", verifiedScoreG: null, finalizedAt: null };
            db.runs.set(originRunId, run);
            return copy(run);
          },
          async setDraft({ founderId, originRunId, draft }) {
            const run = db.runs.get(originRunId);
            if (!run || run.founderId !== founderId || run.status !== "in_progress") throw new Error("Open Origin run not found");
            run.draft = draft === null ? null : copy(draft);
          },
          async getRunResults({ founderId, originRunId }) {
            return db.quests.filter((q) => q.originRunId === originRunId && q.founderId === founderId)
              .sort((a, b) => a.completedAt - b.completedAt || a.caseId.localeCompare(b.caseId)).map(copy);
          },
          async insertQuestResult(row) {
            const run = db.runs.get(row.originRunId);
            if (!run || run.founderId !== row.founderId) throw new Error("foreign key violation");
            if (db.quests.some((q) => q.originRunId === row.originRunId && q.caseId === row.caseId)) throw violation("v2_origin_quest_results_pkey");
            db.quests.push(copy(row));
          },
          async finalizeRun({ founderId, originRunId, verifiedScoreG, finalizedAt }) {
            const run = db.runs.get(originRunId);
            if (!run || run.founderId !== founderId || run.status !== "in_progress") throw new Error("Origin run could not be finalized");
            Object.assign(run, { status: "finalized", draft: null, verifiedScoreG, finalizedAt });
          },
          async creditCapital({ founderId, deltaG }) { const c = db.capital.get(founderId); c.balanceG += deltaG; return c.balanceG; },
          async insertCapitalCredit(c) {
            if (db.ledger.some((l) => l.originRunId === c.originRunId)) throw violation("v2_capital_credit_ledger_origin_run_id_key");
            if (db.ledger.some((l) => l.founderId === c.founderId && l.idempotencyKey === c.idempotencyKey)) throw violation("v2_capital_credit_ledger_founder_id_idempotency_key_key");
            if (!(c.creditDeltaG > 0) || c.bestAfterG !== c.previousBestG + c.creditDeltaG || c.bestAfterG > c.verifiedScoreG) throw new Error("check constraint violation");
            db.ledger.push(copy(c));
          },
          async insertSettlement(s) {
            if (db.settlements.some((x) => x.originRunId === s.originRunId)) throw violation("v2_origin_settlements_pkey");
            if (db.settlements.some((x) => x.founderId === s.founderId && x.idempotencyKey === s.idempotencyKey)) throw violation("v2_origin_settlements_founder_id_idempotency_key_key");
            if ((s.outcome === "credited") !== (s.creditDeltaG > 0) || (s.outcome === "credited") !== (s.transactionId !== null)) throw new Error("check constraint violation");
            db.settlements.push(copy(s));
          },
          async recordFinalization({ founderId, bestScoreG, creditDeltaG, bestRunId, graduatedAt }) {
            const q = db.qualification.get(founderId);
            q.bestScoreG = bestScoreG;
            q.totalCreditedG += creditDeltaG;
            q.bestRunId = bestRunId ?? q.bestRunId;
            q.finalizedRuns += 1;
            q.graduatedAt = q.graduatedAt ?? graduatedAt;
            q.revision += 1;
          },
          async addReputationEvent(e) {
            if (db.reputation.some((x) => x.founderId === e.founderId && x.dedupeKey === e.dedupeKey)) throw violation("v2_reputation_events_founder_id_dedupe_key_key");
            db.reputation.push(copy(e));
          },
          async addTelemetryEvent(e) {
            if (db.telemetry.some((x) => x.dedupeKey === e.dedupeKey)) return false;
            db.telemetry.push(copy(e));
            return true;
          },
          async getLatestRun(founderId) {
            const mine = [...db.runs.values()].filter((r) => r.founderId === founderId).sort((a, b) => b.runNumber - a.runNumber);
            const run = mine.find((r) => r.status === "in_progress") ?? mine[0];
            return run ? { run: copy(run), results: await tx.getRunResults({ founderId, originRunId: run.originRunId }) } : null;
          },
          async listSettlements(founderId, limit) {
            return db.settlements.filter((s) => s.founderId === founderId)
              .map((s) => ({ ...copy(s), runNumber: db.runs.get(s.originRunId).runNumber }))
              .sort((a, b) => b.runNumber - a.runNumber).slice(0, limit);
          },
          async getReceipt(id, hash) {
            const found = db.receipts.get(`${uid}:${id}`);
            if (!found) return null;
            if (found.hash !== hash) throw new FounderError("request_id_conflict", "requestId reused for another command", 409);
            return copy(found.response);
          },
          async setReceipt(id, response, hash) {
            const cutoff = clock() - commandBudget.windowSeconds * 1000;
            const recent = [...db.receipts.entries()].filter(([k, v]) => k.startsWith(uid + ":") && v.at > cutoff).length;
            if (recent >= commandBudget.limit) throw new FounderError("rate_limited", "Command rate limit exceeded", 429);
            db.receipts.set(`${uid}:${id}`, { hash, response: copy(response), at: clock() });
          }
        };
        try {
          return await fn(tx);
        } catch (error) {
          db = backup; // rollback
          throw error;
        }
      });
      queue = job.catch(() => {});
      return job;
    }
  };
}
