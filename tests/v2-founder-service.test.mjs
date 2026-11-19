import { createMemoryFounderStore } from "./support/memory-founder-store.mjs";
import { defineFounderSuite } from "./support/founder-suite.mjs";
import { computeDay2Retention } from "../server/v2/telemetry-contract.mjs";

// In-memory twin of the PostgreSQL store; the SAME suite runs against real Postgres in tests/integration.
function create({ commandBudget = { limit: 100000, windowSeconds: 60 } } = {}) {
  const store = createMemoryFounderStore({ commandBudget });
  const fingerprint = "memory-v1-fixture";
  const env = {
    store,
    async reconnect() { return store; },
    async close() {},
    async counts() {
      const d = store.db;
      return { founders: d.founders.size, runs: d.runs.size, questResults: d.quests.length, ledger: d.ledger.length, settlements: d.settlements.length, reputation: d.reputation.length, telemetry: d.telemetry.length };
    },
    async ledgerRows() { return structuredClone(store.db.ledger); },
    async telemetry() { return structuredClone(store.db.telemetry); },
    async founderIdFor(uid) { return store.db.tgAccounts.get(String(uid)); },
    async retentionView() {
      return computeDay2Retention(store.db.telemetry, { minCohortSize: 1 })
        .map(({ cohortDay, cohortKind, cohortSize, returnedNextUtcDay, returned24To48h }) => ({ cohortDay, cohortKind, cohortSize, returnedNextUtcDay, returned24To48h }));
    },
    async assertReconciled() {
      const d = store.db;
      for (const [founderId, cap] of d.capital) {
        const credits = d.ledger.filter((l) => l.founderId === founderId).reduce((s, l) => s + l.creditDeltaG, 0);
        const q = d.qualification.get(founderId);
        if (cap.balanceG !== credits || q.totalCreditedG !== credits) throw new Error("reconciliation mismatch");
        const best = Math.max(0, ...d.ledger.filter((l) => l.founderId === founderId).map((l) => l.bestAfterG));
        if (q.bestScoreG !== best) throw new Error("best score mismatch");
      }
      const finalized = [...d.runs.values()].filter((r) => r.status === "finalized");
      if (finalized.some((r) => !d.settlements.some((s) => s.originRunId === r.originRunId))) throw new Error("finalized run without settlement");
    },
    legacy: { async seed(uid) { store.addLegacyPlayer(uid); }, async fingerprint() { return fingerprint; } }
  };
  return env;
}
defineFounderSuite("memory", { create: async (opts) => create(opts) });
