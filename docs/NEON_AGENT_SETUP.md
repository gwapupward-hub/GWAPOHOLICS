# Configure a Neon-enabled coding agent from iPhone

**Status:** Project-side bootstrap prepared; **developer-environment login and global installation are not yet verified**.

Neon's official setup instructions: https://neon.com/prompts/agent-setup.md

## ChatGPT (this conversation)

The connected Neon integration is already authenticated. It can list project `square-mode-74279855` and run read-only PostgreSQL 18 queries, without adding Neon credentials to a chat or repository. ChatGPT's connector access does not imply that Neon CLI / global Neon skills are installed in an external coding agent.

## Persistent development agent: Claude Code in GitHub Codespaces

1. Open the [GWAPOHOLICS repository](https://github.com/gwapupward-hub/GWAPOHOLICS) in Safari on iPhone.
2. Use **Code → Codespaces** to open an existing persistent Codespace, or create one on a reviewed branch. Do not create a Codespace on a production connection-string branch for a restore.
3. In its integrated terminal, run:
   ```bash
   node --version
   bash scripts/setup-neon-coding-agent.sh
   ```
4. The bootstrap checks for Node.js **22.20+**, runs `npm install -g neon@latest`, prints the CLI version, and runs `neon login`. Authorize the resulting Neon browser sign-in **yourself**. Never share account password, API keys, or URLs containing credentials with ChatGPT or GitHub.
5. The script then attempts `neon plugins --global --agent claude-code -y`. If that combined install is unavailable it runs Neon's documented `neon skills -y --global --agent claude-code` and `neon mcp -y --agent claude-code` fallback.
6. Reload Claude Code via `/reload-plugins` where supported, or restart it. Confirm that the Neon CLI and MCP tools are visible and list project `square-mode-74279855` **read-only**.
7. For a Codex developer environment, run `NEON_AGENT=codex bash scripts/setup-neon-coding-agent.sh` instead. For Cursor use `NEON_AGENT=cursor` in the matching Cursor-supported development environment. The actual agent host—not this chat—must install and retain global skills.

Only announce Neon's official **Setup Complete** status when CLI installation, authenticated login, skills, and MCP configuration all succeed in the same persistent agent environment.

## Security and launch boundaries

This repository contains [AGENTS.md](../AGENTS.md) with GWAPOHOLICS-specific Neon project IDs, branch isolation, and read-only-first operating rules. No new Neon database, production schema, application secret, B2 object or Telegram bot configuration is created by this setup.

**Important current anomaly:** During the Neon connector check on November 16, the Preview branch `br-billowing-sea-bcx8nhn7/neondb` had **0** rows across game tables, while inherited `br-damp-scene-bc9ep85r/neondb` still held the earlier **2/5/7/27** aggregate records. Before any migration or recovery action, investigate this discrepancy without resetting or copying data. Release gate #30 stays blocked.
