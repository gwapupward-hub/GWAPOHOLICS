// TEST SUPPORT ONLY: deterministic helpers to drive Origin runs through the real service.
import { CASES } from "../../cases.mjs";
import { resolvedPath } from "../../game-core.mjs";
import { executeFounderCommand } from "../../server/v2/founder-service.mjs";

export const QUEST_IDS = ["streaming-pivot", "brand-backlash", "supply-shock", "founder-runway", "inflation-trap"];

/** Every four-decision chain for a quest with its raw simulated result for `seed`. */
export function allPaths(caseId, seed) {
  const quest = CASES.find((c) => c.id === caseId);
  const ids = quest.stages.map((s) => s.options.map((o) => o.id));
  const out = [];
  for (const a of ids[0]) for (const b of ids[1]) for (const c of ids[2]) for (const d of ids[3]) {
    const path = [a, b, c, d];
    out.push({ path, delta: resolvedPath(quest, path, seed).reduce((sum, step) => sum + step.delta, 0) });
  }
  return out;
}
export const bestPath = (caseId, seed) => allPaths(caseId, seed).reduce((m, x) => (x.delta > m.delta ? x : m)).path;
export const worstPath = (caseId, seed) => allPaths(caseId, seed).reduce((m, x) => (x.delta < m.delta ? x : m)).path;
export const medianPath = (caseId, seed) => {
  const sorted = allPaths(caseId, seed).sort((a, b) => a.delta - b.delta);
  return sorted[Math.floor(sorted.length / 2)].path;
};

let counter = 0;
export const nextRequestId = (prefix = "req") => `${prefix}-${++counter}-${Math.random().toString(36).slice(2, 8)}`;

export function harness({ store, config, telegramUserId = "4100000001", seed = 7, startAt = 1_800_000_000_000 } = {}) {
  let now = startAt;
  const base = () => ({ store, config, telegramUserId, newSeed: () => seed });
  const send = (command, extra = {}) => executeFounderCommand({ ...base(), command, requestId: nextRequestId(command), now: (now += 1000), ...extra });
  return {
    get now() { return now; },
    advance(ms) { now += ms; },
    seed,
    snapshot: () => executeFounderCommand({ ...base(), command: "snapshot", now: (now += 1000) }),
    send,
    startRun: () => send("origin_start_run"),
    async playQuest(caseId, path) {
      await send("origin_start_quest", { caseId });
      let last;
      for (const choiceId of path) last = await send("origin_choose", { caseId, choiceId });
      return last;
    },
    /** Plays all five quests; `pick` is (caseId, seed) => path. Returns the final snapshot. */
    async playRun(pick) {
      let last = await this.startRun();
      for (const id of QUEST_IDS) last = await this.playQuest(id, pick(id, seed));
      return last;
    }
  };
}
