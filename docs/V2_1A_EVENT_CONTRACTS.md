# v2.1-A — event contracts (telemetry schema v1)

Source of truth: `server/v2/telemetry-contract.mjs` (and the `CHECK` in migration 002). Tests: `tests/v2-contracts.test.mjs`, `tests/support/founder-suite.mjs`.

## Principles

1. **Server-originated only.** Every event is written by server code, inside the same database transaction as the action it describes. No endpoint accepts an event, score or timestamp from a client.
2. **Observational.** Events never decide a credit. Authoritative state lives in `v2_origin_*`, `v2_capital_*`.
3. **Pseudonymous and un-joinable.** `analytics_key`, `source_ref` and `dedupe_key` are HMAC-derived from `GWAP_V2_ANALYTICS_KEY`. `v2_telemetry_events` contains no Telegram id, founder id, run id or transaction id and has no foreign keys, so the table alone cannot be re-linked to an account. Rotating or deleting the key unlinks history.
4. **Allow-listed properties.** Values are enums, bounded integers or booleans. Free text, names, quest answers/paths, wallet addresses and Telegram identifiers cannot be represented (rejected by `validateEventProperties`; also checked in tests).
5. **Fail closed.** With no analytics key configured, no events are written and the game still works.
6. **Idempotent.** `dedupe_key` is unique; replayed commands return the stored receipt and emit nothing.
7. **Reserved events are enforced twice.** Code throws, and the table `CHECK` does not list them.

## Common fields

`event_id` (random UUID), `event_name`, `schema_version` (=1), `analytics_key` (32 hex), `occurred_at` (server UTC), `occurred_on` (UTC date), `cohort_day` (UTC date of the founder's first login), `cohort_kind` (`new` \| `legacy_v1`), `source_ref` (HMAC of the source record, nullable), `properties` (≤ 1 KB), `dedupe_key`.

## Events

| Event | Status | Emitted when | Dedupe | Properties |
| --- | --- | --- | --- | --- |
| `session_started` | active | first v2 request after ≥ 30 min of server-observed inactivity (or at enrollment) | founder + session ordinal | `sessionOrdinal` 1..1e6 |
| `founder_first_login` | active | enrollment (first `origin_start_run`) | founder | `cohortKind` |
| `origin_quest_completed` | active | 4th committed decision of a quest | run + quest | `questId`, `runNumber`, `questOrder` 1..5, `scoreBand` q1..q5 |
| `origin_run_finalized` | active | 5th quest completes | run | `runNumber`, `scoreBand`, `isReplay` |
| `origin_capital_credit_committed` | active | atomic settlement of a finalized run, credited **or** zero-delta | run | `runNumber`, `outcome` (`credited`\|`no_improvement`), `scoreG`, `previousBestG`, `creditDeltaG`, `policyVersion` |
| `founder_entered_v2` | active | `enter_hub`, first time only | founder | `capitalStatus` (`zero`\|`insufficient`\|`unclassified`) |
| `founder_goal_viewed` | active | snapshot served to a founder who has entered the hub, once per session per goal-ladder version | founder + session + ladder version | `goalsVersion`, `goalCount` 3..5, `basis` = `server_snapshot` |
| `first_company_opened` | **reserved** | build 2.1-B, after a company creation commits | founder | none |
| `first_operating_loss` | **reserved** | build 2.1-C, after the first verified negative net operating cycle | founder | none |

`founder_goal_viewed` is a **server-side impression** (the server served the ladder), not proof that the client rendered it.
Exact G amounts appear in `origin_capital_credit_committed` for first-party economy review. If events are ever exported to a third party, reduce them to bands first.

## Sessions

A new session starts when `now − last_seen_at ≥ 30 min` (`SESSION_GAP_MS`) or at enrollment. Refreshes, retries, parallel opens from several devices and cookie re-issues inside the window are one session (tested with 6 parallel snapshots). `last_seen_at` is written at most once per minute.

## Day-2 retention (defined, queryable, tested)

- **Cohort:** founders whose `founder_first_login` falls on a UTC calendar day, split by `cohort_kind` (newcomers vs legacy testers).
- **Next-UTC-day return (primary):** ≥ 1 `session_started` on `cohort_day + 1` (UTC).
- **Rolling 24–48 h (secondary, for interpretation):** ≥ 1 `session_started` in `[first_login + 24 h, first_login + 48 h)`.
- **Denominator:** all founders in the cohort cell. **Timezone:** UTC. **Exclusions:** none automatic; internal/test accounts must be excluded by the analyst before reading results.
- **Reporting floor:** a cell is `reportable` only when `cohort_size ≥ 5` (k-anonymity).
- **Implementations that must agree:** SQL view `v2_day2_retention_cohorts` and pure `computeDay2Retention()`; the shared test compares them on engineered data (a 6 h return counts only as next-day; a 30 h return counts only in the rolling window).
- A founder who returns on day 2 but only ever opens the app (no commands) is counted, because opening records a session.

## Not defined in Sprint 1

`founder_directory_viewed`, `recovery_path_viewed`, `recovery_completed`, `business_type_previewed` (listed in draft PR #50) were outside the Sprint 1 event list and are intentionally absent from the registry and the table `CHECK`.
