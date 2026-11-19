/**
 * GWAPOHOLICS v2.1-A "Founder Entry" — contract versions shared by the server,
 * the database migration and the event schema. Bump a number here only together
 * with a new additive migration; never rewrite stored records in place.
 */
export function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Reflect.ownKeys(value)) deepFreeze(value[key]);
  }
  return value;
}

export const V2_CONTRACTS = deepFreeze({
  founderIdentity: 1,
  originRun: 1,
  originSettlement: 1,
  capitalCreditLedger: 1,
  reputationEvidence: 1,
  telemetry: 1,
  goalLadder: 1,
  businessTemplate: 1,
  hubSnapshot: 1,
  migration: "002_v2_founder_entry"
});

/** Server-side feature identifiers surfaced (read-only) to the client. */
export const V2_FEATURES = deepFreeze({
  founderHub: "founder_hub",
  originQualification: "origin_qualification",
  businessOpening: "business_opening",
  founderDirectory: "founder_directory",
  externalReputationLinking: "external_reputation_linking"
});
