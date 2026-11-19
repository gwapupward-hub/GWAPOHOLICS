import { deepFreeze, V2_CONTRACTS } from "./versions.mjs";

/**
 * Founder Goal Ladder (contract v1): 5 named milestone cards.
 *
 * Goal state is DERIVED on the server from verified receipts only; the client
 * can neither mark a goal complete nor request a reward. Only `complete_origin`
 * can be derived in Sprint 1. Business goals stay `upcoming` until a verified
 * business receipt of the matching kind exists (none can be written yet), and
 * no goal carries a G or XP reward.
 */
export const GOAL_LADDER_VERSION = V2_CONTRACTS.goalLadder;

export const GOAL_DEFINITIONS = deepFreeze([
  {
    id: "complete_origin", title: "Complete the Origin",
    why: "Five real-world-inspired quests turn your decisions into verified startup capital.",
    receipt: "origin_graduation", availableIn: "now"
  },
  {
    id: "open_first_company", title: "Open your first company",
    why: "A real operation with costs and customers is where capital starts working.",
    receipt: "company_opened", availableIn: "next build"
  },
  {
    id: "first_operating_cycle", title: "Complete your first operating cycle",
    why: "One full cycle of revenue and costs shows how a business really behaves.",
    receipt: "operating_cycle_completed", availableIn: "a later build"
  },
  {
    id: "profitable_decision", title: "Make a profitable decision",
    why: "Good judgement shows up in the numbers, and so does a bad call.",
    receipt: "profitable_decision_recorded", availableIn: "a later build"
  },
  {
    id: "stay_solvent", title: "Keep your business solvent",
    why: "Surviving several cycles is the real test of a founder.",
    receipt: "solvency_streak_recorded", availableIn: "a later build"
  }
]);

/**
 * @param {{graduated:boolean, openRunQuestsCompleted:number, questCount:number, receipts?:string[]}} facts
 *   `receipts` are server-verified receipt kinds. Nothing in Sprint 1 produces any.
 */
export function deriveGoals({ graduated, openRunQuestsCompleted, questCount, receipts = [] }) {
  const have = new Set(receipts);
  const goals = GOAL_DEFINITIONS.map((def, index) => {
    if (def.id === "complete_origin") {
      const done = graduated || have.has(def.receipt);
      const progress = done ? questCount : Math.min(questCount, Math.max(0, openRunQuestsCompleted));
      return {
        id: def.id, order: index + 1, version: GOAL_LADDER_VERSION, title: def.title, why: def.why,
        status: done ? "completed" : progress > 0 ? "in_progress" : "available",
        progress: { current: progress, total: questCount },
        nextAction: done ? null : "Play your next Origin quest"
      };
    }
    const done = have.has(def.receipt);
    return {
      id: def.id, order: index + 1, version: GOAL_LADDER_VERSION, title: def.title, why: def.why,
      status: done ? "completed" : "upcoming",
      progress: null,
      availableIn: done ? null : def.availableIn,
      nextAction: done ? null : "Unlocks in " + def.availableIn
    };
  });
  return goals;
}
