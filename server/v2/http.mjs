/**
 * HTTP controller for GET/POST /api/v2/founder (feature-flagged, default OFF).
 *
 * Identity is taken ONLY from the signed session cookie. The body may carry
 * command, requestId, caseId and choiceId and nothing else: a founder id, run
 * id, score, balance, event or timestamp supplied by a client is rejected.
 */
import { parseSessionCookie } from "../session.mjs";
import { send, authorizedMutation, jsonBody, exactKeys } from "../http.mjs";
import { executeFounderCommand, FounderError } from "./founder-service.mjs";

const MUTATING = ["origin_start_run", "origin_start_quest", "origin_choose", "enter_hub", "business_open", "operate", "reinvest"];

function fail(res, error) {
  if (error instanceof FounderError) {
    if (error.status === 429) res.setHeader("Retry-After", "60");
    send(res, error.status, { error: error.code });
    return;
  }
  if (error?.code === "23505") { send(res, 409, { error: "conflict" }); return; }
  // Never leak database, host or query details.
  send(res, 503, { error: "founder_service_unavailable" });
}

export async function handleFounder(req, res, { config, sessionSecret, previousSessionSecret, store, now = Date.now(), newSeed } = {}) {
  // Disabled feature: indistinguishable from a missing route, no cookie parsing, no database access.
  if (!config?.founderHubEnabled) { send(res, 404, { error: "not_found" }); return; }
  if (!["GET", "POST"].includes(req.method)) { send(res, 405, { error: "method_not_allowed" }); return; }
  if (!sessionSecret || !store) { send(res, 503, { error: "founder_service_unavailable" }); return; }

  let session;
  try {
    session = parseSessionCookie(req.headers?.cookie, { secret: sessionSecret, previousSecret: previousSessionSecret, now });
  } catch { send(res, 503, { error: "founder_service_unavailable" }); return; }
  if (!session) { send(res, 401, { error: "sign_in_required" }); return; }

  let input = { command: "snapshot" };
  if (req.method === "POST") {
    if (!authorizedMutation(req)) { send(res, 403, { error: "forbidden_origin" }); return; }
    try { input = await jsonBody(req, 2048); } catch { send(res, 400, { error: "invalid_request" }); return; }
    const keys = input?.command === "reinvest" ? ["command","requestId","choiceId","policyVersion"] :
      input?.command === "operate" ? ["command","requestId","choiceId","cycleNumber","policyVersion"] :
      input?.command === "business_open" ? ["command", "requestId", "businessTypeId", "templateVersion", "choiceId"] : ["command", "requestId", "caseId", "choiceId"];
    if (!exactKeys(input, keys) || !MUTATING.includes(input.command)) {
      send(res, 400, { error: "invalid_command" }); return;
    }
  }
  try {
    const founder = await executeFounderCommand({ store, config, telegramUserId: session.userId, now, newSeed, ...input });
    send(res, 200, { founder });
  } catch (error) { fail(res, error); }
}
