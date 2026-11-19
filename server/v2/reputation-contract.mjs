import { createHash } from "node:crypto";
import { deepFreeze, V2_CONTRACTS } from "./versions.mjs";

/**
 * Founder reputation / evidence stream (contract v1).
 *
 * Append-only: a mistake is fixed by a later `correction` or `revocation` event
 * that points at the original (`correctsEventId`), never by editing history.
 * `qualification_performance` (what the Origin Score measured) is a different
 * dimension from `reliability` (behaviour backed by evidence). Sprint 1 emits
 * ONLY qualification evidence; wealth/capital is never evidence of reliability.
 */
export const REPUTATION_SCHEMA_VERSION = V2_CONTRACTS.reputationEvidence;
export const REPUTATION_DIMENSIONS = Object.freeze(["qualification_performance", "reliability"]);
export const REPUTATION_EVENT_TYPES = Object.freeze(["origin_run_finalized", "origin_graduated", "correction", "revocation"]);
/** Types the Sprint 1 code is allowed to emit. */
export const EMITTABLE_NOW = Object.freeze(["origin_run_finalized", "origin_graduated"]);

/** Set to true only after a separate privacy/security review (roadmap section 1). */
export const EXTERNAL_LINKING_APPROVED = false;

export function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  return "{" + Object.keys(value).sort().map((k) => JSON.stringify(k) + ":" + canonicalJson(value[k])).join(",") + "}";
}

export const evidenceDigest = (payload) => createHash("sha256").update(canonicalJson(payload)).digest("hex");

/**
 * Payloads carry scores, counts and policy version only. Quest choices, quest
 * paths and Telegram identifiers are deliberately not representable here.
 */
const PAYLOAD_KEYS = {
  origin_run_finalized: ["originRunId", "runNumber", "verifiedScoreG", "questScoresG", "policyVersion"],
  origin_graduated: ["originRunId", "runNumber", "verifiedScoreG", "policyVersion"],
  correction: ["reason"],
  revocation: ["reason"]
};

export function buildReputationEvent({ eventId, type, dimension = "qualification_performance", subjectRef, policyVersion, payload, occurredAt, dedupeKey, correctsEventId = null }) {
  if (!REPUTATION_EVENT_TYPES.includes(type)) throw new Error("Unknown reputation event type");
  if (!EMITTABLE_NOW.includes(type)) throw new Error("Reputation event type is not emittable yet");
  if (!REPUTATION_DIMENSIONS.includes(dimension)) throw new Error("Unknown reputation dimension");
  if (type !== "correction" && type !== "revocation" && dimension !== "qualification_performance") {
    throw new Error("Only qualification evidence can be emitted in this build");
  }
  const keys = Object.keys(payload ?? {});
  const allowed = PAYLOAD_KEYS[type];
  if (keys.length !== allowed.length || !keys.every((k) => allowed.includes(k))) throw new Error("Reputation payload shape invalid");
  if (!Number.isSafeInteger(occurredAt)) throw new Error("Invalid event time");
  return Object.freeze({
    eventId, type, dimension, schemaVersion: REPUTATION_SCHEMA_VERSION, policyVersion, subjectRef,
    payload: deepFreeze(structuredClone(payload)), evidenceDigest: evidenceDigest(payload),
    dedupeKey, correctsEventId, occurredAt
  });
}

/**
 * Read-only, permission-scoped GwapScore-compatible attestation PREVIEW.
 * Performs no network I/O. Without affirmative consent it returns nothing.
 * Even with consent it is marked non-deliverable until EXTERNAL_LINKING_APPROVED
 * is flipped by a reviewed change. Quest paths never appear.
 */
export function buildAttestationPreview(events, consent) {
  if (!consent || consent.granted !== true || !Array.isArray(consent.scope) || !consent.scope.includes("origin_summary")) {
    return Object.freeze({ allowed: false, reason: "consent_required" });
  }
  const revoked = new Set(events.filter((e) => e.type === "revocation" && e.correctsEventId).map((e) => e.correctsEventId));
  const runs = events
    .filter((e) => e.type === "origin_run_finalized" && !revoked.has(e.eventId))
    .map((e) => ({
      eventId: e.eventId, digest: e.evidenceDigest, policyVersion: e.policyVersion,
      verifiedScoreG: e.payload.verifiedScoreG, occurredAt: e.occurredAt
    }));
  return Object.freeze({
    allowed: true,
    deliverable: EXTERNAL_LINKING_APPROVED,
    schema: "gwapscore-compatible-origin-summary/v1",
    dimension: "qualification_performance",
    bestVerifiedScoreG: runs.reduce((m, r) => Math.max(m, r.verifiedScoreG), 0),
    runs
  });
}
