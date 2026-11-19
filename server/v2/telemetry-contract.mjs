import { createHmac } from "node:crypto";
import { deepFreeze, V2_CONTRACTS } from "./versions.mjs";

/**
 * Versioned, privacy-safe telemetry contract (schema v1).
 *
 * - Every event is emitted by SERVER code after the underlying action has been
 *   verified and is part of the same database transaction as that action.
 *   There is no endpoint that accepts an event from a client.
 * - Events are observational. They are never an input to crediting G.
 * - `analytics_key` is HMAC-SHA256(GWAP_V2_ANALYTICS_KEY, founder_id) truncated
 *   to 32 hex chars: pseudonymous, never derived from a Telegram identifier.
 *   Rotating/deleting the key unlinks all stored events from accounts.
 * - Property values are limited to enums, bounded integers, booleans and a
 *   UUID `sourceRef`. Free text, Telegram IDs, names, quest answers/paths and
 *   wallet addresses cannot be represented.
 */
export const TELEMETRY_SCHEMA_VERSION = V2_CONTRACTS.telemetry;

const QUEST_IDS = ["streaming-pivot", "brand-backlash", "supply-shock", "founder-runway", "inflation-trap"];
const BANDS = ["q1", "q2", "q3", "q4", "q5"];
const int = (min, max) => ({ type: "int", min, max });
const oneOf = (values) => ({ type: "enum", values });
const bool = () => ({ type: "bool" });

/** status: "active" = emitted now; "reserved" = defined, MUST NOT be emitted yet. */
export const EVENT_DEFINITIONS = deepFreeze({
  session_started: {
    status: "active", stage: "engagement", emittedBy: "first v2 request after >=30 min of server-observed inactivity",
    dedupe: "founder + session ordinal", properties: { sessionOrdinal: int(1, 1_000_000) }
  },
  founder_first_login: {
    status: "active", stage: "acquisition", emittedBy: "founder enrollment (begin)",
    dedupe: "founder", properties: { cohortKind: oneOf(["new", "legacy_v1"]) }
  },
  origin_quest_completed: {
    status: "active", stage: "qualification", emittedBy: "fourth committed decision of a quest",
    dedupe: "run + quest", properties: {
      questId: oneOf(QUEST_IDS), runNumber: int(1, 1_000_000), questOrder: int(1, 5), scoreBand: oneOf(BANDS)
    }
  },
  origin_run_finalized: {
    status: "active", stage: "qualification", emittedBy: "fifth quest of a run completes",
    dedupe: "run", properties: { runNumber: int(1, 1_000_000), scoreBand: oneOf(BANDS), isReplay: bool() }
  },
  origin_capital_credit_committed: {
    status: "active", stage: "economy", emittedBy: "atomic settlement of a finalized run (credited or zero-delta)",
    dedupe: "run", properties: {
      runNumber: int(1, 1_000_000), outcome: oneOf(["credited", "no_improvement"]),
      scoreG: int(0, 1_000_000), previousBestG: int(0, 1_000_000), creditDeltaG: int(0, 1_000_000),
      policyVersion: oneOf(["origin-v1-draft"])
    }
  },
  founder_entered_v2: {
    status: "active", stage: "activation", emittedBy: "enter_hub command, first time only",
    dedupe: "founder", properties: { capitalStatus: oneOf(["zero", "insufficient", "unclassified"]) }
  },
  founder_goal_viewed: {
    status: "active", stage: "engagement", emittedBy: "snapshot served to a founder who entered the hub (server-side impression)",
    dedupe: "founder + session ordinal + goal ladder version",
    properties: { goalsVersion: int(1, 100), goalCount: int(3, 5), basis: oneOf(["server_snapshot"]) }
  },
  first_company_opened: {
    status: "reserved", stage: "activation", emittedBy: "build 2.1-B, after a company creation commits",
    dedupe: "founder", properties: {}
  },
  first_operating_loss: {
    status: "reserved", stage: "economy", emittedBy: "build 2.1-C, after the first verified negative net operating cycle commits",
    dedupe: "founder", properties: {}
  }
});

export const ACTIVE_EVENT_NAMES = Object.freeze(
  Object.entries(EVENT_DEFINITIONS).filter(([, d]) => d.status === "active").map(([name]) => name)
);
export const RESERVED_EVENT_NAMES = Object.freeze(
  Object.entries(EVENT_DEFINITIONS).filter(([, d]) => d.status === "reserved").map(([name]) => name)
);

function checkValue(spec, value, label) {
  if (spec.type === "int") {
    if (!Number.isSafeInteger(value) || value < spec.min || value > spec.max) throw new Error("Invalid telemetry property: " + label);
  } else if (spec.type === "enum") {
    if (typeof value !== "string" || !spec.values.includes(value)) throw new Error("Invalid telemetry property: " + label);
  } else if (spec.type === "bool") {
    if (typeof value !== "boolean") throw new Error("Invalid telemetry property: " + label);
  } else throw new Error("Unknown telemetry property type");
}

/** Validates against the allow-list: unknown keys, missing keys and bad values throw. */
export function validateEventProperties(name, properties) {
  const def = Object.hasOwn(EVENT_DEFINITIONS, name) ? EVENT_DEFINITIONS[name] : null;
  if (!def) throw new Error("Unknown telemetry event");
  if (def.status !== "active") throw new Error("Telemetry event is reserved and cannot be emitted yet");
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) throw new Error("Telemetry properties must be an object");
  const allowed = Object.keys(def.properties);
  for (const key of Object.keys(properties)) {
    if (!allowed.includes(key)) throw new Error("Telemetry property not allowed: " + key);
  }
  for (const key of allowed) {
    if (!Object.hasOwn(properties, key)) throw new Error("Missing telemetry property: " + key);
    checkValue(def.properties[key], properties[key], key);
  }
  return properties;
}

export function analyticsKeyFor(founderId, secret) {
  if (typeof secret !== "string" || Buffer.byteLength(secret, "utf8") < 32) throw new Error("Analytics key unavailable");
  if (!/^[0-9a-f-]{36}$/.test(String(founderId))) throw new Error("Invalid founder id");
  return createHmac("sha256", secret).update("gwap-v2-analytics:" + founderId).digest("hex").slice(0, 32);
}

/** Pseudonymous reference to an operational record (e.g. an Origin run). Reconcilable only with the key. */
export function sourceRefFor(recordId, secret) {
  if (typeof secret !== "string" || Buffer.byteLength(secret, "utf8") < 32) throw new Error("Analytics key unavailable");
  if (!/^[0-9a-f-]{36}$/.test(String(recordId))) throw new Error("Invalid source record id");
  return createHmac("sha256", secret).update("gwap-v2-source:" + recordId).digest("hex").slice(0, 32);
}

export const utcDay = (ms) => new Date(ms).toISOString().slice(0, 10);

/**
 * Builds the row stored in v2_telemetry_events. `cohortDay`/`cohortKind` come
 * from the founder record (UTC creation date) so retention needs no joins.
 *
 * Privacy: nothing in the row can be joined back to a founder or a run without
 * the analytics key. `sourceId` (an operational record id) is replaced by an
 * HMAC pseudonym, and the dedupe key is built from the pseudonymous key and
 * pseudonymous source ref, never from founder_id or a run UUID.
 */
export function buildTelemetryEvent({
  name, eventId, founderId, secret, occurredAt, cohortDay, cohortKind, sourceId = null, properties, dedupeParts = []
}) {
  validateEventProperties(name, properties);
  if (!/^[0-9a-f-]{36}$/.test(String(eventId))) throw new Error("Invalid event id");
  if (!Number.isSafeInteger(occurredAt)) throw new Error("Invalid event time");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(cohortDay))) throw new Error("Invalid cohort day");
  if (!["new", "legacy_v1"].includes(cohortKind)) throw new Error("Invalid cohort kind");
  if (!Array.isArray(dedupeParts) || !dedupeParts.every((p) => /^[A-Za-z0-9_-]{1,24}$/.test(String(p)) && !/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(String(p)))) throw new Error("Invalid dedupe parts");
  const analyticsKey = analyticsKeyFor(founderId, secret);
  const sourceRef = sourceId === null ? null : sourceRefFor(sourceId, secret);
  return Object.freeze({
    eventId,
    eventName: name,
    schemaVersion: TELEMETRY_SCHEMA_VERSION,
    analyticsKey,
    occurredAt,
    occurredOn: utcDay(occurredAt),
    cohortDay,
    cohortKind,
    sourceRef,
    properties: Object.freeze({ ...properties }),
    dedupeKey: [name, analyticsKey, ...(sourceRef ? [sourceRef] : []), ...dedupeParts].join(":")
  });
}

/**
 * Pure reference implementation of the day-2 retention definition that the
 * v2_day2_retention_cohorts SQL view must match.
 * Cohort = founders whose founder_first_login falls on a UTC day.
 * Returned (next UTC day) = >=1 session_started on cohort day + 1.
 * Returned (24-48h) = >=1 session_started in [first_login+24h, first_login+48h).
 */
export function computeDay2Retention(events, { minCohortSize = 5 } = {}) {
  const firsts = new Map();
  const sessions = new Map();
  for (const e of events) {
    if (e.eventName === "founder_first_login") firsts.set(e.analyticsKey, e);
    else if (e.eventName === "session_started") {
      if (!sessions.has(e.analyticsKey)) sessions.set(e.analyticsKey, []);
      sessions.get(e.analyticsKey).push(e);
    }
  }
  const out = new Map();
  for (const [key, first] of firsts) {
    const bucket = first.cohortDay + "|" + first.cohortKind;
    const row = out.get(bucket) ?? { cohortDay: first.cohortDay, cohortKind: first.cohortKind, cohortSize: 0, returnedNextUtcDay: 0, returned24To48h: 0 };
    row.cohortSize += 1;
    const mine = sessions.get(key) ?? [];
    const nextDay = utcDay(Date.parse(first.cohortDay + "T00:00:00Z") + 86_400_000);
    if (mine.some((s) => s.occurredOn === nextDay)) row.returnedNextUtcDay += 1;
    if (mine.some((s) => s.occurredAt >= first.occurredAt + 86_400_000 && s.occurredAt < first.occurredAt + 172_800_000)) row.returned24To48h += 1;
    out.set(bucket, row);
  }
  return [...out.values()]
    .map((row) => ({ ...row, reportable: row.cohortSize >= minCohortSize }))
    .sort((a, b) => (a.cohortDay + a.cohortKind).localeCompare(b.cohortDay + b.cohortKind));
}
