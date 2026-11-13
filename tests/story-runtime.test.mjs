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
      assert.ok(outcome?.image?.endsWith("/result-" + band + ".webp"));
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
