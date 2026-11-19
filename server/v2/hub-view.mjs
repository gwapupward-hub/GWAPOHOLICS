import { V2_CONTRACTS, V2_FEATURES } from "./versions.mjs";
import { describePolicy } from "./origin-policy.mjs";
import { buildQuestView } from "./origin-engine.mjs";
import { deriveGoals, GOAL_LADDER_VERSION } from "./goals.mjs";
import { classifyCapital, entryCapitalThresholdG, previewBusinessTemplates, SUPPLIER_DECISION } from "./business-templates.mjs";

/**
 * Builds the player-visible Founder Hub snapshot (contract hubSnapshot v1)
 * from server-side state. The output never contains: Telegram identifiers,
 * the founder UUID, run seeds, raw quest cash flows, idempotency keys, or
 * future-quest payoffs.
 */
export function founderCode(founderId) {
  return "F-" + String(founderId).replace(/-/g, "").slice(0, 8).toUpperCase();
}

import { operatingPolicyFor, operatingChoices } from "./operations.mjs";

function unavailableCopy(reason) {
  return reason === "policy_unapproved"
    ? "Origin scoring is awaiting approval, so qualification is closed for now."
    : "Origin qualification is not open yet.";
}

export function buildNotEnrolledSnapshot({ config }) {
  const policy = config.policy;
  return {
    contract: V2_CONTRACTS.hubSnapshot,
    enrolled: false,
    features: featureFlags(config),
    origin: {
      available: Boolean(policy),
      unavailableReason: policy ? null : config.policyUnavailableReason,
      unavailableMessage: policy ? null : unavailableCopy(config.policyUnavailableReason),
      policy: policy ? describePolicy(policy) : null
    },
    capital: { balanceG: 0, status: "zero", currency: "G" },
    nextStep: policy
      ? {
        id: "start_origin", title: "Begin your Origin",
        body: "Start at 0 G. Play five quests, earn verified startup capital, then enter the Founder Hub.",
        action: { kind: "origin_start_run", label: "START YOUR ORIGIN" }
      }
      : { id: "origin_closed", title: "Origin is not open yet", body: unavailableCopy(config.policyUnavailableReason), action: null }
  };
}

function featureFlags(config) {
  return {
    [V2_FEATURES.founderHub]: true,
    [V2_FEATURES.originQualification]: Boolean(config.policy),
    [V2_FEATURES.businessOpening]: Boolean(config.businessSchemaEnabled && config.starterOffer),
    [V2_FEATURES.founderDirectory]: false,
    [V2_FEATURES.externalReputationLinking]: false
  };
}

function nextStepFor({ graduation, entered, openRun, capitalStatus, bestScoreG, maxScoreG }) {
  if (openRun) {
    return {
      id: "continue_origin", title: "Continue your Origin run",
      body: "Finish all five quests. Capital is credited only when a run is complete.",
      action: { kind: "open_origin", label: "CONTINUE ORIGIN" }
    };
  }
  if (graduation !== "graduated") {
    return {
      id: "start_origin", title: "Play your next Origin quest",
      body: "Complete all five quests to graduate.",
      action: { kind: "origin_start_run", label: "START ORIGIN RUN" }
    };
  }
  if (!entered) {
    return {
      id: "enter_hub", title: "Enter the Founder Hub",
      body: "Your Origin is verified. Step into the Business Underworld.",
      action: { kind: "enter_hub", label: "ENTER THE FOUNDER HUB" }
    };
  }
  if (capitalStatus === "zero" || capitalStatus === "insufficient") {
    return {
      id: "replay_origin", title: "Raise your startup capital",
      body: `Replay the Origin as often as you like. Only a score above your best (${bestScoreG} of ${maxScoreG}) pays out, and a lower score never costs you anything.`,
      action: { kind: "origin_start_run", label: "REPLAY ORIGIN" },
      milestone: { goalId: "open_first_company", status: "upcoming", availableIn: "next build" }
    };
  }
  return {
    id: "prepare_first_company", title: "Get ready to open your first company",
    body: "Your capital is held for your first business. Opening a company arrives in the next build. Preview the starter paths now, or replay the Origin to earn more.",
    action: { kind: "preview_businesses", label: "PREVIEW STARTER BUSINESSES" },
    milestone: { goalId: "open_first_company", status: "upcoming", availableIn: "next build" }
  };
}

/** @param bundle {founder, qualification, capital, latest, settlements} from the store */
export function buildFounderSnapshot({ config, bundle }) {
  const policy = config.policy;
  const { founder, qualification, capital, latest, settlements } = bundle;
  const openRun = latest?.run.status === "in_progress" ? latest : null;
  const graduated = Boolean(qualification.graduatedAt);
  const entered = Boolean(founder.enteredV2At);
  const graduation = graduated ? "graduated" : openRun || qualification.finalizedRuns > 0 ? "qualifying" : "not_started";
  const offer = config.businessSchemaEnabled ? config.starterOffer : null;
  const threshold = offer ? offer.setupCostG + offer.minimumOperatingReserveG : entryCapitalThresholdG({ showIllustrativeEconomics: config.showIllustrativeEconomics });
  const capitalStatus = classifyCapital(capital.balanceG, threshold);
  const questView = policy && latest ? buildQuestView({ policy, latest }) : null;
  const questCount = policy ? policy.questIds.length : 5;
  const maxScoreG = policy ? describePolicy(policy).maxScoreG : 0;
  let nextStep = nextStepFor({ graduation, entered, openRun, capitalStatus, bestScoreG: qualification.bestScoreG, maxScoreG });

  if (entered && !openRun && bundle.business) {
    nextStep = { id: "business_owned", title: "Your company is open", body: "Your opening receipt and operating capital are saved below.", action: null };
  } else if (entered && !openRun && offer && capital.balanceG >= threshold) {
    nextStep = { id: "open_first_business", title: "Open your first business", body: "Review the setup cost and the cash you will keep on hand.", action: { kind: "preview_businesses", label: "REVIEW OPENING TERMS" } };
  }
  const operations = bundle.operations;
  const operatingPolicy = operations && operatingPolicyFor(bundle.business, config.operatingPolicy);
  const goalReceipts = [];
  if (bundle.business) goalReceipts.push("company_opened");
  if (operations?.history.length) goalReceipts.push("operating_cycle_completed");
  if (operations?.everProfitable) goalReceipts.push("profitable_decision_recorded");
  const base = {
    contract: V2_CONTRACTS.hubSnapshot,
    enrolled: true,
    features: featureFlags(config),
    founder: { code: founderCode(founder.founderId), cohort: founder.cohortKind, createdAt: founder.createdAt, enteredHub: entered },
    origin: {
      available: Boolean(policy),
      unavailableReason: policy ? null : config.policyUnavailableReason,
      unavailableMessage: policy ? null : unavailableCopy(config.policyUnavailableReason),
      policy: policy ? describePolicy(policy) : null,
      graduation: { status: graduation, graduatedAt: qualification.graduatedAt },
      personalBestScoreG: qualification.bestScoreG,
      lifetimeCreditedG: qualification.totalCreditedG,
      finalizedRuns: qualification.finalizedRuns,
      openRun: openRun ? { runNumber: openRun.run.runNumber, questsCompleted: openRun.results.length, startedAt: openRun.run.startedAt } : null,
      replay: {
        eligible: Boolean(policy),
        rule: "Replay as often as you like. Only the amount above your best verified score is credited."
      }
    },
    capital: { balanceG: capital.balanceG, status: capitalStatus, currency: "G", note: "Fictional, non-transferable G. No cash value." },
    quest: questView,
    receipts: settlements.map((s) => ({
      runNumber: s.runNumber, verifiedScoreG: s.verifiedScoreG, previousBestG: s.previousBestG,
      creditDeltaG: s.creditDeltaG, bestAfterG: s.bestAfterG, outcome: s.outcome,
      transactionId: s.transactionId, policyVersion: s.policyVersion, settledAt: s.settledAt
    }))
  };

  if (!entered) {
    return { ...base, nextStep };
  }

  return {
    ...base,
    hub: {
      goalLadderVersion: GOAL_LADDER_VERSION,
      goals: deriveGoals({ graduated, openRunQuestsCompleted: openRun ? openRun.results.length : 0, questCount, receipts: goalReceipts }),
      operations: operations && { ...operations, offer: operatingPolicy ? {
        version: operatingPolicy.version, cycleNumber: (operations.history[0]?.cycleNumber ?? 0) + 1,
        capacity: operations.upgrades.reduce((n,u)=>n+u.extraCapacity,operatingPolicy.capacity),
        upgrade: operations.history.length && operatingPolicy.upgrade && !operations.upgrades.some(u=>u.upgradeId === operatingPolicy.upgrade.id)
          ? { ...operatingPolicy.upgrade, affordable: capital.balanceG >= operatingPolicy.upgrade.costG } : null,
        nextAt: operations.history[0]?.nextAt ?? null, choices: operatingChoices(operatingPolicy)
      } : null },
      business: bundle.business ?? null,
      openingOffer: !bundle.business && offer ? { ...offer, supplierDecision: SUPPLIER_DECISION, affordable: capital.balanceG >= threshold } : null,
      businessPreviews: previewBusinessTemplates({ showIllustrativeEconomics: config.showIllustrativeEconomics }),
      recovery: {
        replayAvailable: Boolean(policy),
        educationalActivities: { status: "upcoming", message: "Short educational side activities will offer another way to earn a little capital in a later build." }
      }
    },
    nextStep
  };
}
