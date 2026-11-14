# Release safeguard

Vercel Git integration must NOT automatically deploy pushes to main.

The root vercel.json config sets git.deploymentEnabled.main = false.
Feature branches continue to receive preview builds.

This is a safeguard against accidentally changing production during v1 development,
not a substitute for protected GitHub branch rules or founder-approved release promotion.

Before any release:
- Require pull-request review + passing baseline CI on main via GitHub Rulesets.
- Build an explicitly staged production release with reviewed environment variables.
- Test the staged release, then seek explicit founder approval to promote.
- Never change the Telegram bot or gwapoholics.ton routing during a feature merge.
- Release owner must verify live production alias after any main merge.

See https://vercel.com/docs/project-configuration/git-configuration .
