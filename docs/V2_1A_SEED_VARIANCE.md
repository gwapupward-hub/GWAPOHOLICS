# v2.1-A — Origin seed variance: does evidence-regime luck distort skill → capital?

**Status: analysis only. No scoring was changed.** The draft policy `origin-v1-draft` (unapproved, PR #47 numbers) is unchanged; this document informs the founder decision on it.
Reproduce: `node scripts/analyze-origin-seed-variance.mjs --markdown` (read-only, deterministic, < 1 s).

## How randomness enters a run

Each Origin run gets a fresh server-issued seed. For each quest the seed decides one of two **evidence regimes** (`shifted` / `unshifted`), which changes some option payoffs. Regime probabilities (exact from the driver definitions; the engine's hash assignment matches within 0.2 pp over 20,000 seeds):

| quest | P(shifted) | unshifted worst / median / best | shifted worst / median / best |
| --- | ---: | --- | --- |
| streaming-pivot | 0.238 | 0 / 243 / 450 | 54 / 233 / 500 |
| brand-backlash | 0.467 | 0 / 237 / 500 | 0 / 258 / 500 |
| supply-shock | 0.429 | 0 / 248 / 475 | 0 / 292 / 500 |
| founder-runway | 0.500 | 0 / 312 / 478 | 176 / 355 / 500 |
| inflation-trap | 0.300 | 0 / 269 / 488 | 0 / 306 / 500 |

(Quest scores under the draft policy, 0–500; the policy normalises every quest with the **union** of both regimes' min/max.)

## Exact run-total distributions (all 2^5 regime combinations)

"oracle" picks the best path knowing the regime; "blindBest" plays the single best fixed path per quest while ignoring the regime evidence; "medianPlay" takes the median-scoring path; "worstPlay" the worst; "random" is 200,000 seeded Monte-Carlo runs. Best-of-k = expected personal best after k replays, each with a fresh seed.

| policy | min | p10 | median | p90 | max | mean | E[best of 3] | E[best of 10] | E[best of 25] |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| oracle | 2391 | 2391 | 2425 | 2466 | 2500 | 2428 | 2452 | 2475 | 2487 |
| blindBest | 2387 | 2387 | 2387 | 2441 | 2441 | 2400 | 2417 | 2437 | 2441 |
| medianPlay | 1299 | 1309 | 1367 | 1417 | 1454 | 1368 | 1400 | 1425 | 1439 |
| worstPlay | 0 | 0 | 176 | 230 | 230 | 101 | 175 | 215 | 228 |
| random | 199 | 1021 | 1347 | 1663 | 2284 | 1344 | 1554 | 1720 | 1819 |

Oracle play reaches ≥ 2,400 in 84.8 % of runs, ≥ 2,450 in 24.0 %, and the full 2,500 in **1.5 %** of runs.

## Findings

1. **Regime luck is real but small relative to skill.** For a skilled fixed strategy the regime moves the total by at most **54 points** (2.2 % of the 2,500 cap); for an oracle by **109** (4.4 %). The gap between skilled play and median play is ~**1,000 points** and between median play and worst play ~**1,200**. No inversion was found between clearly different skill levels: P(median play beats an independent skilled run) = 0, P(worst beats median) = 0, P(random beats skilled) = 0. Only near-equal players invert (a lucky blind-best run beats an independent oracle run 17 % of the time; their median gap is 38 points).
2. **The regime distorts the *floor* more than the ceiling.** Because normalisation uses the union of both regimes, the worst possible play in a favourable regime still scores above 0: `founder-runway` 176 and `streaming-pivot` 54 points per quest. Deliberately worst play banks up to **230 G** (9.2 % of cap) from regime luck alone. Conversely the full 500 is unreachable in the unfavourable regime of 4 of 5 quests (best 450–488 there), which is why 2,500 is rare (1.5 %).
3. **Unlimited replays with best-score credit matter far more than the seed.** Even *random* play reaches an expected personal best of **1,554 after 3 replays, 1,720 after 10, 1,819 after 25**; median play's best-of-25 is 1,439. The cap is therefore reachable mainly by persistence and learning, not by first-attempt skill. That matches the founder-approved replay rule ("study decisions by replaying") but it means capital measures *persistence plus learning* more than raw decision quality.
4. **Economic consequence.** Lifetime credit is bounded by the cap, and credit pays only improvements, so regime luck cannot create unbounded G. It can, however, hand a small, skill-independent head start (up to ~230 G at the bottom, ~54–109 G at the top) and reorder near-equal players.

## Limitations of this model

Skill is represented by four stylised policies, not real players; players can read the evidence and adapt (which pushes real play toward the oracle). Regimes are assumed independent across quests and seeds uniform. Real replay behaviour (how many replays players actually do) is unknown and is the dominant term in finding 3. Numbers describe the **draft** policy only.

## Options for the founder (none implemented)

| Option | Effect | Cost |
| --- | --- | --- |
| A. Accept variance as designed | Simplest; bounded by the cap | Floor/ceiling distortion stays; 2,500 is rare |
| B. Normalise each quest **per regime** (regime-specific min/max) | Removes floor/ceiling distortion; 0–500 reachable in every regime | Changes scoring (new policy version, needs re-approval; stored bests under the old policy need a migration rule) |
| C. Pin the regime per founder per quest (stable seed) | Removes re-roll luck on replays | An unlucky pin permanently lowers a founder's ceiling unless combined with B; reduces replay variety |
| D. Cap replays per period or require evidence of improvement | Limits grinding (finding 3) | New friction; contradicts "unlimited replays" |

Any change is a new versioned policy and an explicit approval, per the roadmap. Until then the draft policy stays restricted to isolated development.
