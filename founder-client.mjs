/**
 * v2.1-A Founder client. Server-authoritative: it sends only
 * {command, requestId, caseId, choiceId} and renders what the server returns.
 * Nothing about scores, capital or goals is ever computed or stored locally
 * (no localStorage, no cookies read; the session cookie is HttpOnly).
 */
function headers() { return { "Content-Type": "application/json", "X-GWAP-Request": "1" }; }

const MESSAGES = {
  401: "Telegram session expired. Reopen the game.",
  429: "Too many actions. Please try again in one minute.",
  409: "That move is not available right now."
};

export function hydrateFounder(body) {
  const f = body?.founder;
  if (!f || typeof f !== "object" || f.contract !== 1 || typeof f.enrolled !== "boolean" ||
      !f.capital || !Number.isSafeInteger(f.capital.balanceG) || f.capital.balanceG < 0) {
    throw new Error("Invalid founder response");
  }
  return f;
}

/**
 * Probe: resolves to the snapshot when the feature is on, or null when it is
 * off/unavailable (404, 401, 5xx, network). A disabled feature is invisible.
 */
export async function fetchFounder({ fetcher = fetch } = {}) {
  try {
    const r = await fetcher("/api/v2/founder", { method: "GET", credentials: "same-origin", cache: "no-store" });
    if (!r?.ok) return null;
    return hydrateFounder(await r.json());
  } catch { return null; }
}

export async function sendFounderCommand({ command, requestId, caseId, choiceId, businessTypeId, templateVersion, cycleNumber, policyVersion }, { fetcher = fetch } = {}) {
  if (!["origin_start_run", "origin_start_quest", "origin_choose", "enter_hub", "business_open", "operate", "reinvest"].includes(command)) throw new Error("Unknown founder command");
  if (typeof requestId !== "string" || !requestId) throw new Error("Missing unique request ID");
  const body = { command, requestId };
  if (caseId !== undefined) body.caseId = caseId;
  if (choiceId !== undefined) body.choiceId = choiceId;
  if (command === "business_open") Object.assign(body, { businessTypeId, templateVersion });
  if (command === "reinvest") body.policyVersion = policyVersion;
  if (command === "operate") Object.assign(body, { cycleNumber, policyVersion });
  const r = await fetcher("/api/v2/founder", { method: "POST", credentials: "same-origin", cache: "no-store", headers: headers(), body: JSON.stringify(body) });
  if (!r?.ok) {
    let code = "";
    try { code = (await r.json())?.error || ""; } catch { /* non-JSON error */ }
    const openingErrors = { cycle_wait: "Your next operating cycle is not open yet.", cycle_changed: "This cycle is already settled. Review the saved receipt.", cycle_closed: "Operating terms are unavailable.", insufficient_capital: command === "reinvest" ? "Your operating capital cannot cover that expansion." : command === "operate" ? "You need enough capital to cover operating costs before opening." : "Your capital must cover the setup cost and operating reserve.", already_open: "Your first business is already open.", offer_unavailable: "These opening terms are unavailable. Review the latest offer." };
    const error = new Error(openingErrors[code] || MESSAGES[r?.status] || "Founder service unavailable. Your confirmed progress is saved.");
    error.status = r?.status; error.code = code;
    throw error;
  }
  return hydrateFounder(await r.json());
}
