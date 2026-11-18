import test from "node:test";
import assert from "node:assert/strict";
import { rankedForDate, upsertScore } from "../leaderboard.mjs";

test("leaderboard replaces a repeated run and ranks the best local score", () => {
  const first = upsertScore([], { challengeId: "daily:2026-02-12:case", dateKey: "2026-02-12", score: 420, name: "Founder", at: 1 });
  const improved = upsertScore(first, { challengeId: "daily:2026-02-12:case", dateKey: "2026-02-12", score: 760, name: "Founder", at: 2 });
  assert.equal(improved.length, 1);
  assert.equal(improved[0].score, 760);
  const replayedLower = upsertScore(improved, { challengeId: "daily:2026-02-12:case", dateKey: "2026-02-12", score: 120, name: "Founder", at: 3 });
  assert.equal(replayedLower[0].score, 760);
});

test("leaderboard ranks only the selected day and caps visible rows", () => {
  const entries = Array.from({ length: 12 }, (_, index) => ({
    challengeId: `daily:2026-02-12:${index}`,
    dateKey: "2026-02-12",
    score: index * 50,
    name: `Player ${index}`,
    at: index
  }));
  entries.push({ challengeId: "daily:2026-02-13:other", dateKey: "2026-02-13", score: 1000, name: "Tomorrow", at: 0 });
  const ranked = rankedForDate(entries, "2026-02-12");
  assert.equal(ranked.length, 10);
  assert.equal(ranked[0].score, 550);
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked.at(-1).rank, 10);
});
