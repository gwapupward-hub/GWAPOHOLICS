# GWAPOHOLICS — Coding Agent Instructions

## Neon setup

- Use the official setup guide at https://neon.com/prompts/agent-setup.md.
- In a **persistent coding-agent terminal**, bootstrap via `bash scripts/setup-neon-coding-agent.sh`. Default agent ID is `claude-code`; Codex operators can choose `NEON_AGENT=codex bash scripts/setup-neon-coding-agent.sh`.
- The script checks Node.js 22.20+, installs the official `neon` CLI, requests browser sign-in from the owner, and installs global Neon skills and MCP. **Setup is not completed by merely committing this script.** Restart or reload your agent afterward.
- In ChatGPT, prefer the already authenticated Neon connector tools. They are not the same thing as having installed the CLI and skills in a Claude Code, Codex, or Cursor terminal.

## Project context

- Neon project: `gwapoholics-v1-preview` / `square-mode-74279855` (PostgreSQL 18).
- Default Neon branch: `main`, ID `br-red-star-bc7lzrr0`. **No production/default branch SQL writes, migrations, resets, or secret changes without separately documented founder approval.**
- Telegram Mini App Preview branch: `preview/feat/v1-private-beta-release-candidate`, ID `br-billowing-sea-bcx8nhn7`.
- Prior isolated recovery branch: `restore-drill/b2-iphone-20261116`, ID `br-damp-scene-bc9ep85r`. Recovery databases belong to drills only; do not promote or bind them to the live Mini App.
- Preview data MUST be rechecked from the live branch every time. A November 16 read-only query found Preview's game tables empty after earlier queries found 2 players, 5 quest runs, 7 ledger rows and 27 command receipts. The inherited `neondb` on the recovery branch still held those prior rows. **Do not assume the current game state is safe, reset anything, or copy old rows back without an explicit recovery plan and owner approval.**

## Neon operating rules

1. Start with read-only inspection: list project, resolve branch IDs, inspect schema and relevant aggregates.
2. Use separate temporary Neon branches and empty databases for development migrations and restore drills. A Neon branch may copy source data, so a newly created branch is **not** proof of an empty restore destination.
3. Before any schema migration: prepare/diff against the intended isolated branch, test rollback, obtain user approval, and capture redacted evidence.
4. Never expose Neon credentials, PostgreSQL connection URIs, B2 keys, `age` identity files, Telegram `initData`, Telegram user IDs, or row-level player data in chat, code, CI, logs, pull requests, or public issues.
5. GWAPOHOLICS game balances are server-authoritative, non-transferable educational `G`; no real onchain token exists. Preserve ledger idempotency and settlement constraints.
6. The B2 backup restoration gate is currently **OPEN** at https://github.com/gwapupward-hub/GWAPOHOLICS/issues/30. The backup source workflow must verify the intended Preview endpoint and nonempty public game data. A valid PostgreSQL schema, empty tables, or a successful upload is not recoverability proof.
7. For the backup drill, restore only `public` game tables into a **new empty dedicated database**, not into live Preview, Neon default/main, or the inherited Neon Auth schema.
8. No production Vercel deploy, public `@GwapoholicsBot` changes, TON DNS change, or Solana token launch without separate founder approval; see https://github.com/gwapupward-hub/GWAPOHOLICS/issues/34.

## Read-only identity check

Preferred via the connected Neon MCP tools (project and branch set explicitly) or a locally authenticated Neon CLI session. Aggregate query only, never row-level data:

```sql
SELECT current_database() AS db,
  (SELECT count(*) FROM public.players) AS players,
  (SELECT count(*) FROM public.quest_runs) AS quests,
  (SELECT count(*) FROM public.virtual_ledger) AS ledger,
  (SELECT count(*) FROM public.command_receipts) AS receipts;
```

The agent must distinguish **connector connected**, **CLI installed**, **CLI authenticated**, and **agent skills/MCP installed**; these are separate acceptance checks.
