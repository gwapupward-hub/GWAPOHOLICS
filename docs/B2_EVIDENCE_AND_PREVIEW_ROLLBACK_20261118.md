# GWAPOHOLICS — Backblaze evidence + reversible Preview recovery
2026-11-18 · **PREPARED — no active Preview write or production launch approved**

A populated Neon copy is NOT evidence of restoring a Backblaze B2 encrypted archive. Keep Backblaze restoration and active Preview cutover as separate gates.

## Baseline and newly prepared isolation

| Dataset | Branch/database | Rows: players/quests/ledger/receipts |
| --- | --- | --- |
| Active Preview (blue) | `br-billowing-sea-bcx8nhn7/neondb` | `1/1/2/5` |
| Historical source | `br-damp-scene-bc9ep85r/neondb` | `2/5/7/27` |
| Founder-tested recovered state (green) | `br-polished-unit-bc02b798/neondb` | `2/5/7/27` |
| NEW active Preview rollback copy | `br-ancient-frog-bcqroqhe` | no-compute copy of blue |
| NEW empty B2 target | `br-wispy-queen-bcyqvr1w/gwap_b2_evidence_20261118` | **zero public tables** |

Rollback branch `rollback/pre-recovery-preview-20261118` was created at 2026-11-18 08:33:34 UTC from active Preview, parent LSN `0/1FD64D8`. It has no compute and must not be deleted. This is a POINT-IN-TIME COPY, not a fresh backup of later writes. Neon rejected the requests to protect these branches because the plan's protected-branch quota was reached. A native snapshot of this non-root branch was also rejected. **No rollback artifact is protected against an authorized deletion; do not claim otherwise.** A second, fresh rollback copy must be created after writer freeze, before any cutover.

Old named B2 restoration databases `gwap_b2_restore_20261116` and `_v2` on `br-damp-scene-bc9ep85r` still have `0/0/0/0`; their inherited populated `neondb` is not B2 evidence.

## A. Create the actual B2 source archive (owner-controlled)

The existing main-branch `.github/workflows/preview-backup.yml` validates that the GitHub `preview-backup` environment's `NEON_PREVIEW_BACKUP_DATABASE_URL` points to direct Neon host `ep-super-shadow-bci5cjya.c-16.us-east-1.aws.neon.tech`, database `neondb`, dedicated read-only role `gwapoholics_backup_reader`. This live Preview host was independently checked again. **Its current archive would contain 1/1/2/5, NOT the older 2/5/7/27.** Backing up current Preview is valuable, but it does not safeguard the older five-quest history. Keep the historical Neon source and clone intact until a separate offsite archive of that candidate is proved.

1. Privately verify or update the GitHub `preview-backup` environment secret to the exact **direct, read-only, TLS** active Preview connection. Never paste URLs into chats/issues/screenshots. Ensure the bucket-scoped upload credentials and PUBLIC `BACKUP_AGE_RECIPIENT` are set; the age PRIVATE identity stays on the owner's trusted device.
2. Run **Actions → Encrypted Neon Preview backup → Run workflow** on `main`. Verify the endpoint/role guard, all-four-nonzero source counts, archived COPY audit, encrypted upload and checksum succeeded. Record the exact new GitHub run ID and `postgres/gwapoholics-preview-YYYYMMDDTHHMMSSZ-RUNID.dump.age` key. Do not reuse the old November 15 empty-data artifact.
3. In private Backblaze B2, verify the exact immutable **version IDs** for both the encrypted archive and its `.sha256` object. Both must show ≥30 days of Object Lock. Use a separate READ-ONLY B2 key for recovery and metadata retrieval.

## B. Restore B2 ciphertext to the NEW empty database

Provisioning is done and independently verified: Neon `br-wispy-queen-bcyqvr1w`, new database `gwap_b2_evidence_20261118`, zero public tables, PostgreSQL 18.7, direct host `ep-royal-math-bc1hxchn.c-16.us-east-1.aws.neon.tech`. **No Vercel application or Telegram bot is attached to this new database.**

Use a trusted owner-controlled shell with `aws`, `age`, `node`, PostgreSQL **18** `pg_restore`/`psql` and the repository checked out at this PR branch. Set these environment values privately (do not post them anywhere):

- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` — read-only, bucket-scoped Backblaze key
- `B2_OBJECT_KEY` — full `postgres/...dump.age` key selected from the successful run
- `B2_ARCHIVE_VERSION_ID` and `B2_CHECKSUM_VERSION_ID` — exact B2 version IDs
- `AGE_IDENTITY_FILE` — absolute local path to the private age identity; NEVER place it in the workflow or repo
- `RESTORE_TEST_DATABASE_URL` — DIRECT Neon connection to `gwap_b2_evidence_20261118` only
- `GWAP_CONFIRM_DISPOSABLE_RESTORE=yes` — explicit operator preflight confirmation

After reviewing the host/database target, run:

`bash scripts/collect-b2-restore-evidence.sh`

The script rejects any other target; downloads exact B2 object versions; validates encrypted SHA-256, both individual 30-day Object Lock windows, age decrypt and PostgreSQL 18 archive TOC; counts actual nonempty archived game COPY rows; refuses any nonempty public destination; then runs `pg_restore --schema=public --single-transaction --no-owner --no-acl --exit-on-error`. It compares the four restored counts to the source archive's COPY counts and runs the existing structural/index/ledger verifier. Plaintext temporary files are deleted on exit (ordinary deletion on flash media is not guaranteed secure erasure).

**Never retry a failed or interrupted restore into the same partially used database.** Diagnose and create another new empty isolated target under a separately reviewed plan.

Record the script's sanitized PASS/FAIL, two Object Lock retain-until dates, object version IDs, SHA-256, exact restored database and aggregate counts in a PRIVATE operations evidence manifest. Public GitHub comments should contain only aggregate row counts, PASS/FAIL and a private-manifest reference; no credentials, identity, private object URLs or player rows. **#30 stays OPEN until a genuine nonempty archive restore and independent Neon check are evidenced.**

## C. Reversible active Preview recovery plan — NO CUTOVER AUTHORIZED

Existing accepted **green** candidate: founder's `@GwapRecovery_bot` displayed 2,710 G, five completed missions, persistent progress after reopening, and no duplicate reward. This validates an isolated Neon-branch copy, not B2 provenance.

Before any approved Preview change:

1. **Freeze ALL writers** to active Preview (bot/API, web deployment, scheduled processes). Record last known four table counts and private row fingerprints from blue and green; compare per-player quest/ledger deltas again. The shared post-reset quest was previously a duplicate subset of historical progress, but newer writes may invalidate that analysis. Abort if any novel/divergent activity exists.
2. Create a NEW no-compute rollback branch from **frozen** active Preview and record its LSN and counts. Also capture an independent encrypted, verifiable backup of the frozen live state; preserve the already-created rollback branch `br-ancient-frog-bcqroqhe` as an earlier checkpoint. Branch-protection quota is exhausted and must be handled as a risk.
3. Preserve the second historical player. The **proposed, unapproved** policy is to prefer historical 2,710 G / five quests for the overlapping player when current quest/ledger activity is a proven replay subset. New post-reset command receipts must be retained for audit, **not blindly injected into live idempotency history**. Never append colliding ledger IDs or take `MAX(balance)`.
4. Preferred **blue/green rollback rehearsal**: leave both Neon datasets physically unchanged. After founder's separate cutover approval, switch only the explicitly designated PRIVATE Preview Vercel server-side `DATABASE_URL` from blue to founder-tested green, keep writes frozen, redeploy the exact reviewed commit and verify signed Telegram login, full progress, ledger invariants and no duplicate settlement. Keep the old URL and immutable build metadata in a private rollback record.
5. If any check fails **before resuming writes**, switch that same private Preview environment back to the saved blue `DATABASE_URL` and deployment, then verify 1/1/2/5 counts and session behavior. This is a **service-routing rollback**, not a physical database merge. If new writes occur on green after cutover, do NOT silently revert to blue and discard them; perform a separate reconciliation and obtain approval.
6. A later *physical* restoration of the canonical active Neon branch is a distinct, more invasive migration and requires separate transactional rehearsal, tested rollback and explicit authorization.

Neither the original public bot nor public-production Vercel environment should be modified during this preparation. Remove recovery-only `api/recovery-source.js` and its host-pinned diagnostics before any public release branch is created. No merging of this ops PR until the owner reviews the workflow/CI and separately approves any necessary main-branch deployment consequences.

**Gates:** #30 = B2 provenance PENDING; #42 = isolated gameplay PASS, active Preview cutover PENDING; #34 = public production BLOCKED. Android testing remains deferred; Solana withdrawals/tokens remain planning only.
