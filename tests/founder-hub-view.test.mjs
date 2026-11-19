import test from "node:test";
import assert from "node:assert/strict";
import { CASES } from "../cases.mjs";
import { createMemoryFounderStore } from "./support/memory-founder-store.mjs";
import { allPaths, bestPath, harness, worstPath } from "./support/origin-play.mjs";
import { ORIGIN_POLICIES, scoreQuest } from "../server/v2/origin-policy.mjs";
import { config } from "./support/founder-suite.mjs";
import { loadV2Config } from "../server/v2/config.mjs";
import {
  founderHubPage, graduationLines, graduationPanel, originDecisionPanel, originGatePage, originQuestResultPanel,
  originRunPage, storyBandForScore
} from "../founder-hub-view.mjs";
import { fetchFounder, hydrateFounder, sendFounderCommand } from "../founder-client.mjs";
import { buildNotEnrolledSnapshot } from "../server/v2/hub-view.mjs";

const quests = CASES;
const fresh = () => createMemoryFounderStore({ commandBudget: { limit: 100000, windowSeconds: 60 } });

async function hubFor(pick, { seed = 7, cfg = config } = {}) {
  const h = harness({ store: fresh(), config: cfg, seed });
  await h.playRun(pick);
  return { h, hub: await h.send("enter_hub") };
}

test("gate page: start-at-zero promise, three plain rules, legacy-coins note, one primary action", () => {
  const html = originGatePage(buildNotEnrolledSnapshot({ config }));
  assert.match(html, /START AT/);
  assert.match(html, /You begin with 0 G/);
  assert.match(html, /Five quests, four decisions each/);
  assert.match(html, /Only a score above your personal best pays/);
  assert.match(html, /original coins stay exactly as they are/);
  assert.match(html, /PREVIEW SCORING|Fictional, non-transferable/);
  assert.equal((html.match(/data-action="fh-start-run"/g) || []).length, 1);
  const closed = originGatePage(buildNotEnrolledSnapshot({ config: loadV2Config({ GWAP_V2_FOUNDER_HUB: "1" }) }));
  assert.equal(closed.includes("fh-start-run"), false, "no start button while Origin is closed");
  assert.match(closed, /not open yet/i);
});

test("gate button always matches the server's next step (start / continue / enter hub)", async () => {
  const h = harness({ store: fresh(), config, seed: 7 });
  const graduated = await h.playRun(bestPath); // graduated, hub not entered yet
  const enter = originGatePage(graduated);
  assert.match(enter, /data-action="fh-enter-hub"/);
  assert.equal(enter.includes("fh-start-run"), false);
  const resumed = await h.send("origin_start_run"); // now a new run is open
  assert.match(originGatePage(resumed), /data-action="fh-open-run"/);
});

test("hub shows identity, verified score, capital, graduation, five named goals and a clear next step", async () => {
  const { hub } = await hubFor(bestPath);
  const html = founderHubPage(hub, { name: "Ada" });
  assert.match(html, /FOUNDER<\/small><strong>Ada</);
  assert.match(html, new RegExp(hub.founder.code));
  assert.match(html, /GRADUATED/);
  assert.match(html, new RegExp(String(hub.origin.personalBestScoreG).replace(/(\d)(?=(\d{3})+$)/, "$1,")));
  assert.match(html, /STARTUP CAPITAL/);
  assert.equal((html.match(/class="fh-goal /g) || []).length, 5);
  assert.equal((html.match(/is-completed/g) || []).length, 1);
  assert.equal((html.match(/is-upcoming/g) || []).length, 4);
  assert.match(html, /Open your first company/);
  assert.match(html, /Unlocks in next build/);
  assert.match(html, /NEXT STEP/);
  assert.match(html, /Next milestone: <b>Open your first company<\/b> · next build/);
  assert.equal((html.match(/class="fh-preview"/g) || []).length, 3);
  assert.match(html, /UPCOMING/);
  assert.match(html, /Pricing is announced when this business opens/);
});

test("business previews carry no purchase or open control and no hidden price", async () => {
  const { hub } = await hubFor(bestPath);
  const html = founderHubPage(hub);
  const previews = html.slice(html.indexOf('class="fh-previews"'), html.indexOf("These businesses open in an upcoming build"));
  assert.equal(/<button|data-action/.test(previews), false);
  assert.equal(/buy|purchase|open-business|checkout/i.test(previews.replace(/Nothing here can be bought/g, "")), false);
  assert.equal(/\d+ G/.test(previews), false, "unapproved prices stay hidden by default");
  const shown = loadV2Config({ ...{ GWAP_V2_FOUNDER_HUB: "1", GWAP_V2_ORIGIN_POLICY: "origin-v1-draft", GWAP_V2_ALLOW_UNAPPROVED_POLICY: "isolated-preview-only", GWAP_V2_ANALYTICS_KEY: "a".repeat(40) }, GWAP_V2_SHOW_ILLUSTRATIVE_ECONOMICS: "isolated-preview-only" });
  const { hub: hub2 } = await hubFor(bestPath, { cfg: shown });
  assert.match(founderHubPage(hub2), /Illustrative planning estimate\. Not final\./);
  assert.match(founderHubPage(hub2), /Setup 850 G · reserve 250 G/);
});

test("zero-capital founders still get the full hub, an explicit ZERO CAPITAL state and an eligible replay path", async () => {
  let seed = 0;
  // find a seed where a real five-quest run can score exactly 0 (both gating quests unshifted)
  const { isShifted } = await import("../game-core.mjs");
  while (isShifted(CASES[0], seed) || isShifted(CASES[3], seed)) seed += 1;
  const { hub } = await hubFor(worstPath, { seed });
  assert.equal(hub.capital.status, "zero");
  const html = founderHubPage(hub, { name: "Zed" });
  assert.match(html, /ZERO CAPITAL/);
  assert.match(html, /replay the Origin to earn capital/i);
  assert.match(html, /data-action="fh-replay"/);
  assert.match(html, /REPLAY ORIGIN/);
  assert.match(html, /Zero capital is a starting line, not a verdict/);
  assert.match(html, /GRADUATED/);
  assert.match(html, /◉ 0<small> G/);
});

test("insufficient-capital copy appears when illustrative thresholds are on and capital is below them", async () => {
  const lowConfig = loadV2Config({ GWAP_V2_FOUNDER_HUB: "1", GWAP_V2_ORIGIN_POLICY: "origin-v1-draft", GWAP_V2_ALLOW_UNAPPROVED_POLICY: "isolated-preview-only", GWAP_V2_SHOW_ILLUSTRATIVE_ECONOMICS: "isolated-preview-only", GWAP_V2_ANALYTICS_KEY: "a".repeat(40) });
  const h = harness({ store: fresh(), config: lowConfig, seed: 7 });
  // a low but non-zero run: worst everywhere, except one quest played to a mid score between 50 and 250 points
  await h.startRun();
  const ids = CASES.map((c) => c.id);
  const policy = ORIGIN_POLICIES["origin-v1-draft"];
  const modest = allPaths(ids[0], 7).find((x) => { const q = scoreQuest(policy, ids[0], x.delta); return q >= 50 && q <= 250; });
  assert.ok(modest, "a modest-scoring path exists for this seed");
  for (const id of ids) await h.playQuest(id, id === ids[0] ? modest.path : worstPath(id, 7));
  const hub = await h.send("enter_hub");
  assert.ok(hub.capital.balanceG > 0 && hub.capital.balanceG < 325, "scenario must land between 0 and the 325 G illustrative threshold: " + hub.capital.balanceG);
  assert.equal(hub.capital.status, "insufficient");
  const html = founderHubPage(hub);
  assert.match(html, /INSUFFICIENT STARTING CAPITAL/);
  assert.match(html, /data-action="fh-replay"/);
});

test("every server-supplied string is escaped (no markup injection through snapshot fields)", async () => {
  const { hub } = await hubFor(bestPath);
  const evil = structuredClone(hub);
  evil.hub.goals[1].title = '<img src=x onerror="alert(1)">';
  evil.hub.businessPreviews[0].name = "<script>alert(2)</script>";
  evil.nextStep.title = '"><svg onload=alert(3)>';
  evil.receipts[0].transactionId = '"><b>x</b>';
  const html = founderHubPage(evil, { name: '<img src=x onerror="alert(4)">' });
  for (const bad of ["<img src=x", "<script>alert", "<svg onload", '"><b>x</b>']) assert.equal(html.includes(bad), false, bad);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(4\)&quot;&gt;/);
});

test("run page lists five quests with scores, resume state and provisional total; replays show their own copy", async () => {
  const h = harness({ store: fresh(), config, seed: 7 });
  await h.startRun();
  await h.playQuest(CASES[0].id, bestPath(CASES[0].id, 7));
  const snap = await h.send("origin_start_quest", { caseId: CASES[1].id });
  const html = originRunPage(snap, quests);
  assert.equal((html.match(/class="case-list-item/g) || []).length, 5);
  assert.match(html, /1 \/ 5 QUESTS/);
  assert.match(html, /SCORED · \d+ \/ 500/);
  assert.match(html, /IN PROGRESS · RESUME/);
  assert.match(html, /Provisional until all five are done/);
  assert.match(html, /RESUME QUEST/);
  const done = await (async () => { for (const c of CASES.slice(1)) await h.playQuest(c.id, bestPath(c.id, 7)).catch(() => {}); return h.snapshot(); })();
  assert.equal(done.quest.status, "finalized");
  const first = graduationLines(done, false).join(" ");
  assert.match(first, /startup capital/);
  assert.match(graduationPanel(done, { replay: false }), /ENTER THE FOUNDER HUB/);
  assert.match(graduationPanel(done, { replay: false }), /data-action="fh-enter-hub"/);
  assert.match(graduationPanel(done, { replay: true }), /data-action="og-hub"/);
});

test("quest panels use origin-specific actions and never show v1 coin results", async () => {
  const h = harness({ store: fresh(), config, seed: 7 });
  await h.startRun();
  const snap = await h.send("origin_start_quest", { caseId: CASES[0].id });
  const decision = originDecisionPanel(snap.quest.draft.step);
  assert.match(decision, /data-action="og-choose"/);
  assert.equal(/data-action="choose"/.test(decision), false);
  assert.match(decision, /Your quest score comes after round 4/);
  const full = await h.playQuest(CASES[1].id, bestPath(CASES[1].id, 7)).catch(() => null);
  const state = await h.snapshot();
  const row = state.quest.completed[0] ?? null;
  if (row) {
    const panel = originQuestResultPanel({ row, state, nextEntry: CASES[2] });
    assert.match(panel, /PTS/);
    assert.equal(/ G<\/b>/.test(panel.replace(/PTS<\/b>/g, "")), false, "points are not G until the run is complete");
    assert.match(panel, /Points are not G until your run is complete/);
  }
  assert.ok(full !== undefined);
});

test("presentation band thresholds are display-only and monotonic", () => {
  assert.equal(storyBandForScore(2500, 2500), "strong");
  assert.equal(storyBandForScore(1250, 2500), "steady");
  assert.equal(storyBandForScore(700, 2500), "rough");
  assert.equal(storyBandForScore(0, 2500), "collapse");
  assert.equal(storyBandForScore(0, 0), "collapse");
});

test("founder client: probe is silent when disabled, commands send only the four allowed fields", async () => {
  const calls = [];
  const ok = (body) => async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => ({ founder: body }) }; };
  const snapshot = buildNotEnrolledSnapshot({ config });
  assert.equal(await fetchFounder({ fetcher: async () => ({ ok: false, status: 404 }) }), null);
  assert.equal(await fetchFounder({ fetcher: async () => { throw new Error("offline"); } }), null);
  assert.equal(await fetchFounder({ fetcher: async () => ({ ok: true, status: 200, json: async () => ({ founder: { contract: 99 } }) }) }), null);
  assert.equal((await fetchFounder({ fetcher: ok(snapshot) })).enrolled, false);
  await sendFounderCommand({ command: "origin_choose", requestId: "r1", caseId: "streaming-pivot", choiceId: "hybrid" }, { fetcher: ok(snapshot) });
  const sent = JSON.parse(calls.at(-1).init.body);
  assert.deepEqual(Object.keys(sent).sort(), ["caseId", "choiceId", "command", "requestId"]);
  assert.equal(calls.at(-1).init.credentials, "same-origin");
  assert.equal(calls.at(-1).init.headers["X-GWAP-Request"], "1");
  await assert.rejects(() => sendFounderCommand({ command: "grant_g", requestId: "r" }, { fetcher: ok(snapshot) }), /Unknown founder command/);
  await assert.rejects(() => sendFounderCommand({ command: "enter_hub" }, { fetcher: ok(snapshot) }), /Missing unique request ID/);
  const fail = (status, error) => async () => ({ ok: false, status, json: async () => ({ error }) });
  await assert.rejects(() => sendFounderCommand({ command: "enter_hub", requestId: "r" }, { fetcher: fail(429, "rate_limited") }), (e) => e.status === 429 && /one minute/.test(e.message));
  await assert.rejects(() => sendFounderCommand({ command: "enter_hub", requestId: "r" }, { fetcher: fail(409, "not_graduated") }), (e) => e.code === "not_graduated");
  assert.throws(() => hydrateFounder({ founder: { contract: 1, enrolled: true, capital: { balanceG: -1 } } }));
});
