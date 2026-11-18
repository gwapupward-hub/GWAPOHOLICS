import test from "node:test";
import assert from "node:assert/strict";
import { allBriefings, briefingFor } from "../briefing.mjs";

test("Founder Brief exposes a complete five-day strategy cycle", () => {
  const briefs = allBriefings();
  assert.equal(briefs.length, 5);
  assert.equal(new Set(briefs.map((brief) => brief.id)).size, briefs.length);
  for (const brief of briefs) {
    assert.ok(brief.signal);
    assert.ok(brief.prompt);
    assert.ok(brief.takeaway);
  }
});

test("Founder Brief rotation is deterministic and changes by day", () => {
  const monday = briefingFor(Date.UTC(2026, 0, 5, 12));
  const nextDay = briefingFor(Date.UTC(2026, 0, 6, 12));
  assert.equal(monday.dateKey, "2026-01-05");
  assert.notEqual(monday.id, nextDay.id);
  assert.equal(briefingFor(Date.UTC(2026, 0, 5, 23)).id, monday.id);
});
