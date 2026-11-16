# GWAPOHOLICS — Preview Backup Source Remediation

**Recovery gate #30: OPEN.** This document concerns the **Preview** backup only. The Telegram production bot, Vercel production target, TON domain, and primary Neon branch are unchanged.

## What the November 16, 2026 recovery report established

The founder-provided `GWAPOHOLICS Database Migration and Deployment Report.md` (prepared by an external operator) states that an encrypted B2 ZIP download passed a SHA-256 check (`cd3cb8a7a7fb4f1e79d7ee99c4a6396a532810082117d750084d5530724ee44d`), successfully decrypted using age, and restored locally using PostgreSQL 18.7. The report records **zero** game rows in all four tables; the only nonempty table in the local restored snapshot was `neon_auth.project_config` (one row). It also describes a schema-only repair in the disposable Neon restore database and a newly encrypted local backup created from that **empty game dataset**.

**Independent read-only Neon cross-check, November 16:** the real Preview database `br-billowing-sea-bcx8nhn7/neondb` contained **2 players, 5 quest runs, 7 virtual-ledger entries, 27 receipts**. The default/main database `br-red-star-bc7lzrr0/neondb` had **0/0/0/0**. Both isolated recovery DBs had **0/0/0/0**. This suggests the archived backup may have used the wrong source (or a snapshot taken before game activity), but does **not** prove which branch was used.

The report's checksum was supplied by the operator. It was **not independently linked to an immutable version ID of the specific GitHub Actions B2 upload**, so exact source-object provenance and Object Lock evidence remain pending.

## New automatic protection

Workflow `.github/workflows/preview-backup.yml` now has fail-closed checks **before encryption and any B2 upload**:

1. Require the `NEON_PREVIEW_BACKUP_DATABASE_URL` GitHub environment secret to point to the **direct** Neon endpoint for branch `br-billowing-sea-bcx8nhn7`:
   - Host: `ep-super-shadow-bci5cjya.c-16.us-east-1.aws.neon.tech`
   - Database name: `neondb`
   - Role: `gwapoholics_backup_reader` (read-only)
2. Query all four Preview public application-table row counts. If **any** is zero, abort the backup before encryption or upload. This is a private-beta safety assumption: all four tables currently have real records. If product policy intentionally resets Preview to empty, review this condition rather than bypassing it casually.
3. Dump **only** schema `public` with PostgreSQL 18. Previously, the full custom archive also included `neon_auth` tables. This workflow is for GWAPOHOLICS **game-ledger recovery**, not an independent Neon Auth disaster-recovery system.
4. Independently parse the **actual generated archive** through PostgreSQL 18 `pg_restore --data-only --schema=public` and stream the COPY payload to `scripts/audit-backup-copy.mjs`. This rejects missing or empty data sections while emitting only aggregate row counts. No COPY contents, Telegram user identifiers, connection URI or decrypted rows are logged.
5. Only upon passing all checks, perform age encryption and upload the archive plus separate encrypted-archive SHA-256 checksum to private B2 as before.

**Important:** source hostname is intentionally pinned to the verified Preview branch and may need review if Neon legitimately changes the branch compute endpoint. A failed safe check is NOT permission to remove the guard.

## Owner's iPhone action — update the GitHub secret

The assistant cannot read back GitHub Actions secret values and must never ask you to paste them in chat.

1. In Safari, open [Neon Console](https://console.neon.tech/), project `square-mode-74279855`. Select branch `preview/feat/v1-private-beta-release-candidate` (`br-billowing-sea-bcx8nhn7`) and database `neondb`.
2. Select **direct/unpooled** connection and role `gwapoholics_backup_reader`. Obtain a fresh read-only connection string with TLS enforced. If you cannot obtain that role's valid password, rotate only the dedicated backup-reader credential using an approved Neon flow, then update its consumer; do **not** reset production or game runtime roles.
3. In Safari, open [GitHub GWAPOHOLICS repository](https://github.com/gwapupward-hub/GWAPOHOLICS) → **Settings** → **Environments** → **preview-backup** → **Environment secrets**. Update `NEON_PREVIEW_BACKUP_DATABASE_URL` to the verified Preview **read-only** URL. Use a private clipboard/session; never put the string in PR comments, GitHub issue text or chat.
4. Only after the code is merged and the secret updated, open **Actions → Encrypted Neon Preview backup → Run workflow**. Confirm logs show the endpoint/database/role guard passed, the four live table counts were all nonzero, the archived COPY checks passed, and encryption/B2 upload succeeded.
5. Privately confirm the exact B2 object key, SHA-256 match, source snapshot/time, and Object Lock retention for **both** objects. Do not confuse a fresh backup with the empty earlier artifact.
6. Perform a **brand-new** isolated empty-Neon game-data restore from the newly downloaded age-encrypted archive using the verified local private key. Pass the four-table SQL integrity verifier and compare recovered row counts to that archive's protected aggregate manifest / successful workflow log. A schema-only restore or an all-zero restore does not pass #30.

## Operational security

The report says a private age identity and a Neon connection string were provided to a separate remote operator. Those secrets may have been handled outside the owner's iPhone. Verify where they were retained, securely revoke or rotate if disclosure cannot be excluded, and use a **new, separately protected age recipient** before public-production backup acceptance if required. Do not post the identity, decrypted database dumps, role grants or `pg_hba.conf` artifacts publicly. The fresh encrypted backup described in the external report contains environment-level configuration and must not be treated as an approved production baseline without review.

## Evidence policy

**Only mark RECOVERY PASS** after successful restoration of **actual nonempty** application records from the exact independently verified B2 object version, zero game-ledger integrity mismatches, retention proof, and operator/founder sign-off. Until then, the recovery gate #30 and public launch gate #34 remain OPEN.
