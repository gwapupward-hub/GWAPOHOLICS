# GWAPOHOLICS v2 Implementation Design (additive)

**Status: design draft for discussion. Not approved. No code.**

v2 adds new systems beside the existing case game. The existing gameplay is not changed. Parameter values are starting points to test, not targets.

---

## 0. Ground rules from the current repo

- **Existing case game stays as it is.** That covers the `game_state` JSON shape, the balance rules (1,000 starting G, missions locked under 100 G, recovery grants 60 G, from `game-core.mjs`), the `snapshot`, `start`, `choose`, and `recover` commands on `/api/game`, and the three-tab nav (PLAY, MISSIONS, YOU).
- **Schema constraints to respect.** `players.balance` is a BIGINT with a CHECK that matches `game_state.balance`. `virtual_ledger.event_type` only allows `welcome`, `quest_settlement`, and `recovery`. v2 should add new tables and avoid altering these.
- **Shared command budget.** `setReceipt` allows 30 writes per user per 60 seconds, counted across all commands in `command_receipts`. If v2 writes receipts into that table, it will starve case play. v2 needs its own receipts table and budget.
- **Serialization.** Writes take `pg_advisory_xact_lock(telegram_user_id)`. v2 transactions must take the same lock so balance writes stay ordered.
- **Server-authoritative.** The client never sends balances, results, or trusted timestamps.
- **In-game only.** `$GWAP` cannot be transferred, withdrawn, or redeemed (`README.md`, legal draft).
- **No feature flags exist yet.** Server code only reads infrastructure env vars.
- **Telegram origin rule.** All `Telegram.WebApp` calls stay on the registered domain (Bot API 10.2, verified).

---

## 1. Decisions needed before code

| ID | Decision | Recommendation | Why |
| --- | --- | --- | --- |
| D1 | Shared balance or separate v2 balance? | Separate hideout balance, no bridge yet | A shared balance changes the 100 G lock and the balance invariant, which touches existing gameplay. |
| D2 | What to call the 48-hour cycles | "Cycles", not "Seasons" | `SEASON 01` already labels the five case files (`app.mjs` lines 194 and 206). |
| D3 | Where the hideout lives | Panel opened from PLAY behind a flag; keep the 3-tab nav | A fourth tab changes the existing shell. Add it later if the panel proves out. |
| D4 | Where heist loot comes from | Minted from a capped house pool, not moved from the defender's balance | Moving balances between players conflicts with the non-transferable rule. Needs counsel. |
| D5 | Monetization timing | None in P1–P4 | Stars and gifts stay deferred per blueprint section F. |
| D6 | Which Telegram features to commit to | Only after checking current Bot API docs | Several are still unverified (section 7). |

---

## 2. Architecture for additive modules

- **Migration `002_v2.sql`.** New tables only, no `ALTER` on existing tables. Follow `AGENTS.md` rule 3: diff against an isolated Neon branch, test rollback, get founder approval, then apply.
- **Service module `server/hideout-service.mjs`.** Mirrors `executeGameCommand`: `store.transaction(uid, tx => …)`, receipts, deterministic outputs.
- **Endpoint `/api/hideout`.** GET for snapshot, POST for commands. Same session cookie and origin checks as `/api/game`.
- **Shared pure module `shared/v2-core.mjs`.** Holds accrual math, cycle functions, upgrade costs, and game simulations. Imported by client and server, tested with `node --test`.
- **Feature flags.** `HIDEOUT_V2`, `CYCLES_V2`, `VAULT_CRACK_V2`, `RAIDS_V2`, `HEISTS_V2`. All default off, read server-side, and returned in the snapshot.
- **Integer money.** Store `$GWAP` as micro-units (1 `$GWAP` = 1,000,000 micro) in BIGINT. Use BigInt in JavaScript. Never use floats for balances.

Draft DDL for the core v2 state:

```sql
CREATE TABLE hideout_states (
  telegram_user_id BIGINT PRIMARY KEY REFERENCES players(telegram_user_id),
  balance_micro    BIGINT NOT NULL CHECK (balance_micro >= 0),
  tier             INT    NOT NULL DEFAULT 1 CHECK (tier >= 1),
  last_accrued_ms  BIGINT NOT NULL,
  energy           INT    NOT NULL CHECK (energy >= 0),
  energy_at_ms     BIGINT NOT NULL,
  state_revision   BIGINT NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE hideout_ledger (
  id                  BIGSERIAL PRIMARY KEY,
  telegram_user_id    BIGINT NOT NULL REFERENCES players(telegram_user_id),
  idempotency_key     TEXT   NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 96),
  event_type          TEXT   NOT NULL CHECK (event_type IN
    ('idle_accrual','tap_batch','upgrade','vault_crack_payout','raid_payout','heist_payout')),
  delta_micro         BIGINT NOT NULL,
  balance_after_micro BIGINT NOT NULL CHECK (balance_after_micro >= 0),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (telegram_user_id, idempotency_key)
);

CREATE TABLE hideout_upgrades (
  telegram_user_id BIGINT NOT NULL REFERENCES players(telegram_user_id),
  upgrade_id       TEXT   NOT NULL,
  level            INT    NOT NULL CHECK (level >= 0),
  PRIMARY KEY (telegram_user_id, upgrade_id)
);

CREATE TABLE v2_receipts (
  telegram_user_id BIGINT NOT NULL REFERENCES players(telegram_user_id),
  idempotency_key  TEXT   NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 96),
  command_hash     CHAR(64) NOT NULL,
  response         JSONB  NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (telegram_user_id, idempotency_key)
);
```

`v2_receipts` has its own 60-second budget, so v2 traffic never counts against case play.

---

## 3. Pillar designs

### 3.1 Hideout (Penthouse): passive income, tapping, upgrades

- **Passive rate.** `rate_micro_per_s` = tier base × bot multiplier × active cycle modifier. All integers.
- **Accrual.** Runs on every hideout command and on resume, inside the same transaction and lock. `elapsed = min(now − last_accrued_ms, cap)`, `earned = floor(rate × elapsed_ms / 1000)`, then set `last_accrued_ms = now` and increment `state_revision`.
- **Offline cap.** Placeholder 8 hours. Tune in playtests.
- **Cycle boundaries.** If an accrual window crosses a Surge/Lockdown boundary, split it into segments and apply each segment's rate. Put this in `shared/v2-core.mjs` with tests.
- **Tap batches.** The client sends `{batchId, taps}` every 2 seconds or more. The server accepts at most `floor(maxTapsPerSec × elapsed_s) + burst` taps, with placeholders of 8 taps/s and a burst of 10. Excess taps are rejected. `batchId` is the idempotency key.
- **Upgrades.** Cost = `round(base × ratio^level)`, computed on the server. Purchase debits the balance and increments the level in one transaction, keyed by request ID.
- **Tiers.** Driven by lifetime earnings. Tier changes never reduce balance.
- **Visuals.** The server returns a stage ID for the hideout art. Use `docs/ASSET_PIPELINE.md`.
- **Starting parameters.** The article's refined curve (cost ratio 1.18, income ratio 1.11) is a shape to test, not a tuned value.

Telemetry this needs (the repo has no analytics today): daily mint, balance percentiles, active-tap share, upgrade funnel.

### 3.2 Vault Crack (Terminal): rogue-lite runs

- **Energy.** Integer, capped. Regenerates from `energy_at_ms` on the server. No client timers decide energy.
- **Run start.** Spends energy, creates a row in `vault_crack_runs`, and picks a seed and modifiers on the server. Seed comes from an HMAC of `(run_id, user)` using a new server secret. Modifiers such as "Corrupted Firewall" come from a fixed list selected by the seed.
- **Simulation.** A pure, deterministic function in `shared/vault-crack-core.mjs`, `state(seed, modifiers, tick)`. The client renders it. Inputs are sent as compact tick-indexed action arrays.
- **Verification.** The server replays the simulation from seed, modifiers, and inputs, rejects runs that exceed duration plus grace, and computes the score. Payout is `base × multiplier(score)` in integer micro, written to the hideout ledger keyed by `run_id`.
- **Failure.** Sets `cooldown_until_ms`.
- **One active run per player.** Enforced by a partial unique index on `status = 'active'`.
- **Tests.** Determinism, golden replays, and fuzzing of malformed inputs.

### 3.3 Cycles (Surge / Lockdown)

- **Pure function.** `cycle_index = floor((now − EPOCH_MS) / 48h)`, `phase = cycle_index mod 2`. `EPOCH_MS` is set once in config and never changes.
- **Scope.** Modifiers affect only v2 systems: passive rate, tap value, Vault Crack payouts, heist defense. They never affect case settlement.
- **Events.** A 15-minute event such as "Sync Spike" is derived from a hash of the cycle and window index plus a server secret, so no scheduler is needed. Event push notifications go through the outbox (section 3.6).
- **Wording.** In-game only. No market, price, or yield language.

### 3.4 Group raids (Vault Boss)

- **Entry point.** The bot posts a raid in the group with a Mini App button and a raid ID. Taps happen inside the Mini App, not as group messages. This avoids bot message rate limits.
- **Creation.** Requires a group-admin check through the bot API (not yet verified).
- **Boss HP.** `base × N^0.85`, where N is member count at start. The article's numbers fit a base of 2,500 (modeled). N requires a member-count call (not yet verified).
- **Contributions.** The client batches damage every 2–3 seconds. The server caps damage per user per window and only counts verified `initData`. No anonymous contributions.
- **Timer.** `ends_ms` is set on the server (5 minutes).
- **Payout.** Pool split by damage share. Idempotent per `(raid, user)`.
- **Pool source.** Minted from a daily house cap. The cap is an economy control.

Tables: `raids(id, chat_id, boss_hp, started_ms, ends_ms, status, pool_micro)` and `raid_contributions(raid_id, telegram_user_id, damage, PK(raid_id, telegram_user_id))`. `chat_id` is BIGINT, so group IDs can be negative.

### 3.5 Syndicate heists (async PvP): design only

Blocked until D4 is answered and the PvP safety review (open question 3) is done.

- **Async.** Attacker dispatches against a defender snapshot (tier, shield) taken at dispatch. Resolved immediately on the server. No live interaction.
- **Win chance.** Logistic on the power ratio with clamps at both ends (modeled).
- **Loot.** Minted from the house pool with a daily cap, per D4. A successful heist removes the defender's shield, not their balance (suggested; to decide).
- **Privacy.** Opponents appear as pseudonymous handles. No Telegram IDs in payloads or logs (`AGENTS.md` rule 4).
- **Audit.** Each heist stores its seed and inputs in a `heists` table. Ops views redact IDs.

### 3.6 Social and notifications

- **Flex cards.** The server renders the card from the snapshot (tier, rank) using the player's chosen display name only. Sharing to Stories needs the method verified (section 7).
- **Push outbox.** `notifications(id, telegram_user_id, kind, dedupe_key UNIQUE, send_after_ms, sent_at_ms)`. Opt-in per kind, quiet hours, and copy without money-pressure language. A batch sender enforces rate limits (limits not yet verified).
- **Add to home screen.** After a first milestone, if the method is confirmed (section 7).

### 3.7 Sensory layer (last phase)

- **Audio.** Web Audio with one sprite sheet. Separate gain buses for SFX and background music. Resume on user gesture and on app activation. Verify the activation lifecycle event first (section 7).
- **Haptics.** Throttle to at most one impact per 60 ms during bursts. The existing guarded calls in `app.mjs` (lines 53, 496, 503) are the starting point.
- **Preferences.** Mute and haptic toggles in DeviceStorage (5 MB per user, verified). The repo currently keeps the motion preference in localStorage, which can migrate later.
- **Reduced motion.** The existing motion preference gates all juice effects.
- **QA.** Physical iOS and Android devices. `docs/IOS_QA_RUN_SHEET.md` already exists.

---

## 4. Existing mechanics: unchanged in v2

v2 does not touch the case game, quest settlement, recovery, the 100 G lock, the three-tab nav, or the `/api/game` endpoints.

Candidate improvements to existing mechanics, kept as a separate track for your call:
- Clearer "why locked" copy on the existing screens (UI text only).
- Analytics events on existing flows, with no logic change.
- Check whether the 30-per-minute command budget is ever hit during normal case play.

---

## 5. Testing and gates

- **Unit (`node --test`).** Accrual math with caps and cycle-boundary splits, tap validation, upgrade costs, Vault Crack determinism, cycle function.
- **Integration (Postgres, following `tests/integration`).** Concurrent commands serialize. Duplicate idempotency keys return the same response. Negative balances are rejected. The v2 budget is independent of the case budget.
- **Regression.** `npm test` and `npm run check` stay green. Add a test asserting the `game_state` shape and the `virtual_ledger` CHECK are unchanged. The browser e2e (`tests/browser/full-season.e2e.mjs`) still passes.
- **Economy simulation.** Run the accrual model over simulated players for 30 days. Report daily mint and balance distribution. A kill switch triggers if mint exceeds the cap.

---

## 6. Phases and exit criteria

| Phase | Scope | Exit criteria |
| --- | --- | --- |
| P0 | Decisions D1–D6, legal scope | Decisions recorded |
| P1 | Cycles and read-only hideout panel, behind a flag | Tests green, no money paths |
| P2 | Hideout earning: taps, passive income, upgrades | Integration tests pass, two-week private-bot playtest, mint within cap |
| P3 | Vault Crack | Replay tests pass, fairness check |
| P4 | Group raids | Group test with the private bot, Telegram policy check |
| P5 | Heists | D4 counsel answer and PvP review complete |
| P6 | Social and notifications | Flags on in preview, opt-in verified |
| P7 | Sensory layer | Device QA on iOS and Android |

**Rollout.** Migrations go to the preview branch first, with approval. Flags stay off by default. Test on `@TestGwap_bot` first. `@GwapoholicsBot` and production need founder approval (`AGENTS.md` rule 8).

---

## 7. Unverified before P4 and P6

Check these against `core.telegram.org/bots/api` before the phase that depends on them:
- `shareToStory` and `addToHomeScreen` availability and behavior.
- The `activated` lifecycle event.
- Group admin check and member-count methods.
- Bot message rate limits.
- CloudStorage limits.
