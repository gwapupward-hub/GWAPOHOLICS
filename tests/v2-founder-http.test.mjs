import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { issueSessionCookie } from "../server/session.mjs";
import { handleFounder } from "../server/v2/http.mjs";
import { loadV2Config } from "../server/v2/config.mjs";
import { FounderError } from "../server/v2/founder-service.mjs";
import { createMemoryFounderStore } from "./support/memory-founder-store.mjs";
import { QUEST_IDS, bestPath } from "./support/origin-play.mjs";
import { baseEnv } from "./support/founder-suite.mjs";

const SECRET = "h".repeat(48), NOW = 1_800_000_000_000, SEED = 7;
const config = loadV2Config(baseEnv);

function cookieFor(uid, now = NOW) { return issueSessionCookie(uid, { secret: SECRET, now }).split(";")[0]; }
function req(method, body, { uid = "5100000001", headers = {}, cookie } = {}) {
  const base = {
    host: "app.example.test", origin: "https://app.example.test", "x-gwap-request": "1",
    "content-type": "application/json", cookie: cookie === undefined ? cookieFor(uid) : cookie === null ? undefined : cookie
  };
  const merged = { ...base, ...headers };
  for (const k of Object.keys(merged)) if (merged[k] === undefined) delete merged[k];
  const raw = body === undefined ? [] : [Buffer.from(typeof body === "string" ? body : JSON.stringify(body))];
  return Object.assign(Readable.from(raw), { method, headers: merged });
}
function res() {
  const headers = {};
  return {
    statusCode: 200, body: "", headers,
    setHeader(n, v) { headers[n.toLowerCase()] = v; }, getHeader(n) { return headers[n.toLowerCase()]; },
    end(b = "") { this.body = b; }, get json() { return JSON.parse(this.body); }
  };
}
const spyStore = () => {
  const inner = createMemoryFounderStore({ commandBudget: { limit: 100000, windowSeconds: 60 } });
  const calls = [];
  return { inner, calls, transaction: (...a) => { calls.push(a[0]); return inner.transaction(...a); } };
};
const call = async (r, store, extra = {}) => {
  const out = res();
  await handleFounder(r, out, { config, sessionSecret: SECRET, store, now: NOW + 1000, newSeed: () => SEED, ...extra });
  return out;
};
let n = 0;
const post = (store, body, opts = {}) => call(req("POST", { requestId: `http-${++n}`, ...body }, opts), store, opts.extra);

test("flag OFF: indistinguishable from a missing route, no cookie parsing, no database access", async () => {
  const store = spyStore();
  const off = loadV2Config({});
  for (const r of [req("GET"), req("POST", { command: "origin_start_run", requestId: "a" }), req("DELETE"), req("GET", undefined, { cookie: "garbage" })]) {
    const out = res();
    await handleFounder(r, out, { config: off, sessionSecret: SECRET, store, now: NOW });
    assert.equal(out.statusCode, 404);
    assert.deepEqual(out.json, { error: "not_found" });
    assert.equal(out.headers["cache-control"], "no-store, private");
  }
  assert.equal(store.calls.length, 0);
  assert.equal(res().statusCode, 200);
});

test("sign-in is required: missing, tampered, wrong-secret and expired cookies are 401", async () => {
  const store = spyStore();
  const good = cookieFor("5100000001");
  for (const cookie of [null, "", "foo=bar", good.slice(0, -3) + "AAA", cookieFor("5100000001", NOW - 2 * 3_600_000)]) {
    const out = await call(req("GET", undefined, { cookie }), store);
    assert.equal(out.statusCode, 401, String(cookie).slice(0, 20));
    assert.deepEqual(out.json, { error: "sign_in_required" });
  }
  const wrongSecret = issueSessionCookie("5100000001", { secret: "z".repeat(48), now: NOW }).split(";")[0];
  assert.equal((await call(req("GET", undefined, { cookie: wrongSecret }), store)).statusCode, 401);
  assert.equal(store.calls.length, 0);
  assert.equal((await call(req("GET"), store, { sessionSecret: "" })).statusCode, 503);
  assert.equal((await call(req("GET"), store, { store: null })).statusCode, 503);
});

test("GET returns the caller's own snapshot; identity comes only from the signed cookie", async () => {
  const store = spyStore();
  const a = await call(req("GET", undefined, { uid: "5100000001" }), store);
  assert.equal(a.statusCode, 200);
  assert.equal(a.json.founder.enrolled, false);
  assert.equal(a.headers["cache-control"], "no-store, private");
  await post(store, { command: "origin_start_run" }, { uid: "5100000001" });
  // spoofing attempts via headers / query-ish fields do not change whose data is returned
  const b = await call(req("GET", undefined, { uid: "5100000002", headers: { "x-telegram-user-id": "5100000001", "x-forwarded-user": "5100000001" } }), store);
  assert.equal(b.json.founder.enrolled, false, "B must not see A's account");
  const a2 = await call(req("GET", undefined, { uid: "5100000001" }), store);
  assert.equal(a2.json.founder.enrolled, true);
  assert.equal(JSON.stringify(a2.json).includes("5100000001"), false);
});

test("POST accepts only command/requestId/caseId/choiceId: client-supplied scores, ids and balances are rejected", async () => {
  const store = spyStore();
  for (const extra of [
    { score: 2500 }, { verifiedScoreG: 2500 }, { creditDeltaG: 999 }, { balance: 99999 }, { founderId: "11111111-1111-4111-8111-111111111111" },
    { telegramUserId: "5100000009" }, { originRunId: "22222222-2222-4222-8222-222222222222" }, { delta: 5 }, { policyVersion: "x" }, { event: "origin_run_finalized" }
  ]) {
    const out = await post(store, { command: "origin_start_run", ...extra });
    assert.equal(out.statusCode, 400, JSON.stringify(extra));
    assert.deepEqual(out.json, { error: "invalid_command" });
  }
  for (const command of ["snapshot", "open_business", "grant_g", "origin_finalize", "enter_hub; DROP TABLE", "", 5, null]) {
    assert.equal((await post(store, { command })).statusCode, 400, String(command));
  }
  assert.equal((await post(store, { requestId: undefined, command: "origin_start_run", requestId: undefined })).statusCode, 400);
  assert.equal(store.calls.length, 0, "rejected requests never open a transaction");
});

test("mutations require same-origin HTTPS, the app header and JSON; bad bodies are 400", async () => {
  const store = spyStore();
  const body = { command: "origin_start_run", requestId: "same-origin-1" };
  for (const headers of [{ origin: "https://evil.example.test" }, { origin: "http://app.example.test" }, { origin: undefined }, { "x-gwap-request": undefined }, { "x-gwap-request": "0" }, { "content-type": "text/plain" }]) {
    assert.equal((await call(req("POST", body, { headers }), store)).statusCode, 403, JSON.stringify(headers));
  }
  assert.equal((await call(req("POST", "not json"), store)).statusCode, 400);
  assert.equal((await call(req("POST", "[1,2]"), store)).statusCode, 400);
  assert.equal((await call(req("POST", "x".repeat(5000)), store)).statusCode, 400);
  assert.equal((await call(req("PUT", body), store)).statusCode, 405);
  assert.equal(store.calls.length, 0);
});

test("end to end over HTTP: Origin run, graduation, hub entry, replay with no extra credit", async () => {
  const store = spyStore();
  const uid = "5100000021";
  const go = async (body) => { const o = await post(store, body, { uid }); assert.equal(o.statusCode, 200, JSON.stringify(o.json)); return o.json.founder; };
  await go({ command: "origin_start_run" });
  let last;
  for (const id of QUEST_IDS) {
    await go({ command: "origin_start_quest", caseId: id });
    for (const choiceId of bestPath(id, SEED)) last = await go({ command: "origin_choose", caseId: id, choiceId });
  }
  assert.equal(last.origin.graduation.status, "graduated");
  const credited = last.capital.balanceG;
  assert.ok(credited > 0);
  const hub = await go({ command: "enter_hub" });
  assert.equal(hub.hub.goals.length, 5);
  await go({ command: "origin_start_run" });
  for (const id of QUEST_IDS) {
    await go({ command: "origin_start_quest", caseId: id });
    for (const choiceId of bestPath(id, SEED)) last = await go({ command: "origin_choose", caseId: id, choiceId });
  }
  assert.equal(last.capital.balanceG, credited, "an equal replay pays nothing");
  assert.equal(store.inner.db.ledger.length, 1);
  const again = await call(req("GET", undefined, { uid }), store);
  assert.equal(again.json.founder.capital.balanceG, credited);
});

test("error mapping: state conflicts 409, throttle 429 + Retry-After, request-id reuse 409", async () => {
  const store = spyStore();
  assert.equal((await post(store, { command: "origin_choose", caseId: QUEST_IDS[0], choiceId: "x" })).json.error, "not_enrolled");
  await post(store, { command: "origin_start_run" });
  const dup = await post(store, { command: "origin_start_run" });
  assert.equal(dup.statusCode, 409);
  assert.deepEqual(dup.json, { error: "run_already_open" });
  const first = await post(store, { command: "origin_start_quest", caseId: QUEST_IDS[0], requestId: "reuse-me" });
  assert.equal(first.statusCode, 200);
  const clash = await post(store, { command: "origin_start_quest", caseId: QUEST_IDS[1], requestId: "reuse-me" });
  assert.equal(clash.statusCode, 409);
  assert.equal(clash.json.error, "request_id_conflict");
  const throttled = { transaction: async () => { throw new FounderError("rate_limited", "Command rate limit exceeded", 429); } };
  const out = await call(req("GET"), throttled);
  assert.equal(out.statusCode, 429);
  assert.equal(out.headers["retry-after"], "60");
});

test("database failures never leak connection strings, hostnames or query text", async () => {
  const leaky = { transaction: async () => { throw new Error("connection to server at postgres://user:p4ss@ep-secret.neon.tech failed: SELECT * FROM v2_founders"); } };
  for (const out of [await call(req("GET"), leaky), await post(leaky, { command: "origin_start_run" })]) {
    assert.equal(out.statusCode, 503);
    assert.deepEqual(out.json, { error: "founder_service_unavailable" });
    assert.equal(out.body.includes("neon"), false);
    assert.equal(out.body.includes("SELECT"), false);
  }
  const unique = { transaction: async () => { throw Object.assign(new Error("duplicate key"), { code: "23505" }); } };
  assert.deepEqual((await call(req("GET"), unique)).json, { error: "conflict" });
});

test("unapproved policy: snapshot works read-only, every mutation is refused with 409 origin_unavailable", async () => {
  const store = spyStore();
  const closed = loadV2Config({ GWAP_V2_FOUNDER_HUB: "1", GWAP_V2_ORIGIN_POLICY: "origin-v1-draft" });
  const snap = await call(req("GET"), store, { config: closed });
  assert.equal(snap.statusCode, 200);
  assert.equal(snap.json.founder.origin.available, false);
  const started = await call(req("POST", { command: "origin_start_run", requestId: "p1" }), store, { config: closed });
  assert.equal(started.statusCode, 409);
  assert.deepEqual(started.json, { error: "origin_unavailable" });
  assert.equal(store.inner.db.founders.size, 0);
});

test("api/v2/founder.js route: default OFF returns 404 and never needs a database", async () => {
  const keys = ["GWAP_V2_FOUNDER_HUB", "DATABASE_URL", "GWAP_SESSION_SECRET"];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    for (const k of keys) delete process.env[k];
    const { default: handler } = await import("../api/v2/founder.js");
    const off = res(); await handler(req("GET"), off);
    assert.equal(off.statusCode, 404);
    assert.deepEqual(off.json, { error: "not_found" });
    process.env.GWAP_V2_FOUNDER_HUB = "1";
    const unconfigured = res(); await handler(req("GET"), unconfigured);
    assert.equal(unconfigured.statusCode, 503);
    assert.equal(unconfigured.body.includes("DATABASE"), false);
  } finally {
    for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
});

test("business commands reject financial and ownership overrides before opening a transaction",async()=>{
  const store = spyStore();
  for (const command of ["business_open","operate","reinvest"]) {
    for (const extra of [{ownerId:"other"},{balanceG:10},{xp:2},{revenueG:5},{settledAt:NOW},{setupCostG:0}]) {
      const out=await post(store,{command,...extra});
      assert.equal(out.statusCode,400);
    }
    assert.equal((await post(store,{command},{cookie:null})).statusCode,401);
  }
  assert.equal(store.calls.length,0);
});
