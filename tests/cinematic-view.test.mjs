import test from "node:test";
import assert from "node:assert/strict";
import { CASES } from "../cases.mjs";
import { createGame, startCase, chooseStep, stageView, evidenceFor, chainResult } from "../game-core.mjs";
import { sceneDirection } from "../story-runtime.mjs";
import { storyStage, introPanel, decisionPanel, consequencePanel, resultPanel, resultScore, homeNarrator, toggleCinematicMotion, storyMotionEnabled } from "../cinematic-view.mjs";

const pivot = CASES.find((c) => c.id === "streaming-pivot");
const seed = 4242;

function shot(overrides = {}) {
  return {
    phase: "decision", direction: sceneDirection(pivot.id, "decision", { round: 1 }), previous: "/assets/scenes/streaming-pivot/decision-01",
    speaker: "market-force", emotion: "surprised", lines: ["A rival just landed a studio deal.", "Board wants a plan."], panel: "<p>panel</p>",
    label: "The Streaming Pivot: round 2 of 4", ribbon: "MISSION 01 · THE RIVAL DEAL", progress: { label: "ROUND 2 OF 4", total: 4, done: 1, current: 1 }, balance: 1000, ...overrides
  };
}

test("the stage is full-screen art with WebP + JPG fallback, focal point and camera preset", () => {
  const html = storyStage(shot());
  assert.match(html, /class="story-stage phase-decision cam-push/);
  assert.match(html, /srcset="\/assets\/scenes\/streaming-pivot\/decision-02\.webp"/);
  assert.match(html, /src="\/assets\/scenes\/streaming-pivot\/decision-02\.jpg"/);
  assert.match(html, /--focal:62% 36%/);
  assert.match(html, /stage-bg-prev[\s\S]*decision-01\.jpg/, "previous background is kept for the crossfade");
  assert.match(html, /class="stage-panel" inert/, "decisions are not reachable until narration finishes");
  assert.match(html, /data-emotion="surprised"/);
  assert.match(html, /aria-label="The Market Force says"/);
  assert.match(html, /class="bubble-text" aria-hidden="true"/, "typed layer is hidden from screen readers");
  assert.match(html, /class="sr-only"><p>A rival just landed a studio deal\.<\/p><p>Board wants a plan\.<\/p>/, "full dialogue is available to screen readers");
  assert.match(html, /data-action="story-exit"/);
  assert.match(html, /data-action="story-skip"/);
  assert.match(html, /data-action="toggle-story-motion"/);
  assert.match(html, /1,000<small>G<\/small>/);
});

test("no crossfade layer when the background does not change", () => {
  assert.doesNotMatch(storyStage(shot({ previous: "/assets/scenes/streaming-pivot/decision-02" })), /stage-bg-prev/);
});

test("narration, labels and ribbons are escaped", () => {
  const html = storyStage(shot({ lines: ["<script>alert(1)</script>"], ribbon: "<b>x</b>", label: '"><img>' }));
  assert.doesNotMatch(html, /<script>|<b>x<\/b>|"><img>/);
  assert.match(html, /&lt;script&gt;/);
});

test("decision panel shows exactly the three visible options and never their outcomes", () => {
  let state = startCase(createGame(1, seed), pivot.id);
  for (let round = 0; round < 4; round += 1) {
    const step = stageView(pivot, state.draft.path, seed);
    const html = decisionPanel(step);
    assert.equal((html.match(/data-action="choose"/g) || []).length, 3);
    for (const option of pivot.stages[round].options) {
      assert.match(html, new RegExp(`data-choice="${option.id}"`));
      assert.ok(!html.includes(option.outcome), "hidden outcome must not leak into the decision view");
      if (option.shifted?.outcome) assert.ok(!html.includes(option.shifted.outcome));
    }
    assert.doesNotMatch(html, /delta/);
    state = chooseStep(state, pivot.id, pivot.stages[round].options[0].id);
  }
});

test("intro, consequence and result panels give a clear next action", () => {
  assert.match(introPanel(pivot, evidenceFor(pivot, seed)), /data-action="decide"/);
  const beat = consequencePanel(2, 4);
  assert.match(beat, /data-action="next-step"/);
  assert.match(beat, /ROUND 3/);
  const path = pivot.stages.map((s) => s.options[2].id);
  const result = chainResult(pivot, path, seed);
  const run = { delta: result.delta, balanceAfter: 1000 + result.delta };
  assert.match(resultPanel({ run, result, next: CASES[1], locked: false }), /data-case="brand-backlash"/);
  assert.match(resultPanel({ run, result, next: undefined, locked: true }), /data-view="recovery"/);
});

test("settled coin change renders with the right sign for count-up", () => {
  assert.match(resultScore(240), /class="stage-score gain"[\s\S]*data-target="240"/);
  assert.match(resultScore(-75), /class="stage-score loss"[\s\S]*−[\s\S]*data-target="75"/);
});

test("home narrator and motion toggle still work", () => {
  assert.match(homeNarrator(), /GWAP-O SAYS/);
  const before = storyMotionEnabled();
  assert.equal(toggleCinematicMotion(), !before);
  assert.match(storyStage(shot()), before ? /story-static/ : /cam-push effect-none"/);
  toggleCinematicMotion();
  assert.equal(storyMotionEnabled(), before);
});
