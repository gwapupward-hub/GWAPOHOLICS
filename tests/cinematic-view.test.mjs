import test from "node:test";
import assert from "node:assert/strict";
import { CASES } from "../cases.mjs";
import { cinematicScene, homeNarrator, toggleCinematicMotion } from "../cinematic-view.mjs";

test("only the asset-backed Streaming Pivot chapter renders full cinematic scenes", () => {
  assert.match(cinematicScene(CASES[0], "intro"), /scenes\/streaming-pivot\/intro\.jpg/);
  assert.match(cinematicScene(CASES[0], "decision", {round:2}), /decision-03\.jpg/);
  assert.match(cinematicScene(CASES[0], "result", {band:"rough"}), /result-rough\.jpg/);
  assert.equal(cinematicScene(CASES[1], "intro"), "");
});
test("narration is escaped and story motion can be toggled", () => {
  assert.match(homeNarrator(), /GWAP-O SAYS/);
  const a = cinematicScene(CASES[0], "decision", {round:0, lineOverride:'<script>alert(1)</script>'});
  assert.doesNotMatch(a, /<script>/);
  assert.match(a, /&lt;script&gt;/);
  const after = toggleCinematicMotion();
  assert.equal(typeof after, "boolean");
  toggleCinematicMotion();
});
