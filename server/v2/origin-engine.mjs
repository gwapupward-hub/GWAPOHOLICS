import { randomBytes } from "node:crypto";
import { CASES } from "../../cases.mjs";
import { chainResult, chooseStep, evidenceFor, stageView } from "../../game-core.mjs";
import { questScoreBand, scoreQuest } from "./origin-policy.mjs";

/**
 * Origin run mechanics. Reuses the approved v1 quest content and its pure
 * functions (chooseStep, stageView, chainResult, evidenceFor) UNCHANGED, but
 * none of v1's balance gating: the v1 100 G lock must never block Origin
 * qualification, and no v1 state is read or written here.
 */
export class FounderError extends Error {
  constructor(code, message, status = 409) {
    super(message);
    this.name = "FounderError";
    this.code = code;
    this.status = status;
  }
}

export const generateRunSeed = () => randomBytes(4).readUInt32BE(0);

export function questFor(policy, caseId) {
  const quest = CASES.find((entry) => entry.id === caseId);
  if (!quest || !policy.questIds.includes(caseId)) throw new FounderError("unknown_quest", "Unknown Origin quest", 409);
  return quest;
}

/** Opens (or re-opens) a chain. A chain with a committed decision cannot be abandoned. */
export function startQuest({ policy, results, draft, caseId }) {
  const quest = questFor(policy, caseId);
  if (results.some((r) => r.caseId === caseId)) throw new FounderError("quest_already_completed", "This quest is already complete in your current run", 409);
  if (draft?.caseId === caseId) return { caseId, path: [...draft.path] };
  if (draft && draft.path.length > 0) throw new FounderError("finish_current_chain", "Finish your current chain first", 409);
  return { caseId: quest.id, path: [] };
}

/** Applies one decision via the unchanged v1 rule; returns the new draft. */
export function applyChoice({ policy, draft, caseId, choiceId }) {
  questFor(policy, caseId);
  try {
    return chooseStep({ draft }, caseId, choiceId).draft;
  } catch {
    throw new FounderError("invalid_choice", "That decision is not available", 409);
  }
}

export function isChainComplete(policy, draft) {
  return draft.path.length === questFor(policy, draft.caseId).stages.length;
}

/** Server-side scoring of a finished chain. Returns what is persisted. */
export function finishQuest({ policy, seed, caseId, path }) {
  const quest = questFor(policy, caseId);
  const result = chainResult(quest, path, seed);
  return {
    caseId,
    path: [...path],
    rawDelta: result.delta,
    band: result.band,
    questScoreG: scoreQuest(policy, caseId, result.delta)
  };
}

function earnedResult(policy, run, row) {
  const quest = questFor(policy, row.caseId);
  const earned = chainResult(quest, row.path, run.seed);
  return {
    caseId: row.caseId,
    title: quest.title,
    questScoreG: row.questScoreG,
    maxQuestScoreG: policy.perQuestMaxG,
    outcomeSign: Math.sign(earned.delta),
    scoreBand: questScoreBand(policy, row.questScoreG),
    band: earned.band,
    // Only earned information, never raw simulated cash flow or the seed.
    result: {
      band: earned.band,
      verdict: earned.verdict,
      narrative: earned.narrative,
      steps: earned.steps.map((s) => ({ prompt: s.prompt, label: s.label, outcome: s.outcome, reasons: s.reasons }))
    }
  };
}

/**
 * Player-visible quest state in the same shape the cinematic UI already uses
 * (draft.step, completed[].result, evidence), minus all v1 coin fields.
 */
export function buildQuestView({ policy, latest }) {
  if (!latest) return null;
  const { run, results } = latest;
  const open = run.status === "in_progress";
  const draft = open && run.draft
    ? (() => {
      const quest = questFor(policy, run.draft.caseId);
      const full = run.draft.path.length >= quest.stages.length;
      return {
        caseId: run.draft.caseId,
        path: [...run.draft.path],
        round: run.draft.path.length,
        step: full ? null : stageView(quest, run.draft.path, run.seed)
      };
    })()
    : null;
  return {
    runNumber: run.runNumber,
    status: run.status,
    completed: results.map((row) => earnedResult(policy, run, row)),
    draft,
    evidence: open ? Object.fromEntries(policy.questIds.map((id) => [id, evidenceFor(questFor(policy, id), run.seed)])) : {},
    provisionalScoreG: results.reduce((sum, r) => sum + r.questScoreG, 0),
    questIds: [...policy.questIds]
  };
}
