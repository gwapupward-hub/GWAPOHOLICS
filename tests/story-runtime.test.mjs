import test from "node:test";
import assert from "node:assert/strict";
import { CASES } from "../cases.mjs";
import { STORYLINES, STORY_RESULT_BANDS, STORY_CHARACTERS, narrativeScene } from "../story-runtime.mjs";

test("narrative configuration maps exactly to the existing five cases", () => {
  assert.deepEqual(Object.keys(STORYLINES).sort(), CASES.map((c) => c.id).sort());
});

test("every case has intro, four decisions and four result scene definitions", () => {
  for (const quest of CASES) {
    const extension = quest.id === "streaming-pivot" ? "jpg" : "webp";
    const intro = narrativeScene(quest.id, "intro");
    assert.ok(intro?.image?.endsWith("/intro." + extension));
    assert.ok(STORY_CHARACTERS[intro.speaker]);
    for (let round = 0; round < 4; round += 1) {
      const stage = narrativeScene(quest.id, "decision", { round });
      assert.ok(stage?.image?.endsWith("/decision-0" + (round+1) + "." + extension));
      assert.ok(STORY_CHARACTERS[stage.speaker]);
      assert.ok(stage.line.length <= 165);
    }
    for (const band of STORY_RESULT_BANDS) {
      const outcome = narrativeScene(quest.id, "result", { band });
      assert.ok(outcome?.image?.endsWith("/result-" + band + "." + extension));
      assert.equal(outcome.speaker, "future-you");
      assert.ok(outcome.line.length <= 165);
    }
  }
});

test("invalid scene lookups fail without exposing game mechanics", () => {
  assert.equal(narrativeScene("not-a-case", "intro"), null);
  assert.equal(narrativeScene("streaming-pivot", "decision", { round: 5 }), null);
  assert.equal(narrativeScene("streaming-pivot", "result", { band: "guaranteed-win" }), null);
  assert.equal("delta" in narrativeScene("streaming-pivot", "decision", { round: 0 }), false);
});

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sceneDirection, reactionFor, hasStoryMode, storyReactionTexts, CHARACTER_ART, CHARACTER_STATES, CAMERA_PRESETS, SCENE_EFFECTS } from "../story-runtime.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));
const onDisk = (base) => ["jpg", "webp"].every((ext) => existsSync(repo + base.slice(1) + "." + ext));

test("Story Mode is enabled only for the asset-backed Streaming Pivot pilot", () => {
  assert.equal(hasStoryMode("streaming-pivot"), true);
  for (const quest of CASES.filter((c) => c.id !== "streaming-pivot")) assert.equal(hasStoryMode(quest.id), false, quest.id);
  assert.equal(sceneDirection("brand-backlash", "intro"), null);
});

test("all nine Streaming Pivot scenes have direction data and committed JPG + WebP art", () => {
  const shots = [["intro"], ...[0, 1, 2, 3].map((round) => ["decision", { round }]), ...STORY_RESULT_BANDS.map((band) => ["result", { band }])];
  const keys = new Set();
  for (const [phase, opts] of shots) {
    const d = sceneDirection("streaming-pivot", phase, opts);
    assert.ok(d, phase);
    keys.add(d.key);
    assert.ok(onDisk(d.base), d.base);
    assert.match(d.focal, /^\d+% \d+%$/);
    assert.ok(CAMERA_PRESETS.includes(d.camera));
    assert.ok(SCENE_EFFECTS.includes(d.effect));
    assert.ok(CHARACTER_STATES.includes(d.emotion));
  }
  assert.equal(keys.size, 9);
  assert.equal(sceneDirection("streaming-pivot", "consequence", { round: 1 }).key, "decision-02");
  assert.equal(sceneDirection("streaming-pivot", "result", { band: "jackpot" }), null);
});

test("result bands have distinct emotional presentations", () => {
  const looks = STORY_RESULT_BANDS.map((band) => { const d = sceneDirection("streaming-pivot", "result", { band }); return `${d.emotion}/${d.effect}`; });
  assert.equal(new Set(looks).size, 4);
});

test("every narrator has a committed portrait and a known accent", () => {
  for (const [id, art] of Object.entries(CHARACTER_ART)) {
    assert.ok(STORY_CHARACTERS[id], id);
    assert.ok(onDisk(art.image), art.image);
  }
});

test("every consequence text a player can see has a matching reaction", () => {
  const quest = CASES.find((c) => c.id === "streaming-pivot");
  const texts = new Set(storyReactionTexts("streaming-pivot"));
  // Consequence beats follow rounds 1–3; round 4 goes straight to the result.
  for (const stage of quest.stages.slice(0, 3)) {
    for (const option of stage.options) {
      assert.ok(texts.has(option.outcome), option.id);
      if (option.shifted?.outcome) assert.ok(texts.has(option.shifted.outcome), option.id + " (shifted)");
    }
  }
  for (const text of texts) assert.ok(CHARACTER_STATES.includes(reactionFor("streaming-pivot", text)));
  assert.equal(reactionFor("streaming-pivot", "unknown text"), "reflecting");
});
