# GWAPOHOLICS — Telegram Bot and Community Launch Configuration SOP

**Status:** Operator-ready instructions, **not executed**. Official bot, domain and public-channel configuration remain locked until the final release build, HTTPS, legal disclosures, exact logo master and staged sign-off are verified.  
**Test bot:** `@TestGwap_bot`. **Public bot:** `@GwapoholicsBot`. **Owned TON name:** `gwapoholics.ton` (not itself an ordinary HTTPS Mini App URL).  
**Platform docs:** [Telegram Mini Apps](https://core.telegram.org/bots/webapps), [BotFather features](https://core.telegram.org/bots/features), [Telegram main app behavior](https://core.telegram.org/api/bots/webapps).

## Pre-configuration verification

- [ ] Confirm the **exact** intended Vercel HTTPS deployment URL, environment, SHA, signed session validation and rollback target. **A READY Preview cannot substitute for a reviewed production build.**
- [ ] Confirm owner control of bot in `@BotFather` and 2FA on operator account. Never copy bot token, session data or user credentials into issues/chats.
- [ ] Confirm approved `GWAPOHOLICS_512_single_path.svg` master: 512×512, transparency, black `#000000`, exactly one path. Do **not** use existing 128px multicolor `brand.svg` as the official icon.
- [ ] Confirm approved Terms/Privacy/age policy, in-app support channel and free-to-play virtual G disclosures.
- [ ] Capture the expected release state: `main` SHA, production Vercel deployment, official bot username and `.ton` DNS state. No action until release gate approval.

## Owner-side BotFather procedure (after release acceptance)

1. Open [@BotFather](https://t.me/BotFather) and choose `/mybots` → `@GwapoholicsBot`.
2. Use **Bot Settings → Configure Mini App → Enable Mini App** to establish the approved HTTPS URL for the Main Mini App. A *Main Mini App* enables the prominent bot-profile Launch App button. [Official reference](https://core.telegram.org/bots/webapps).
3. Configure a **menu button** if useful, via `/setmenubutton` (or Bot Settings → Menu Button); set label to **Play GWAPOHOLICS**, targeting the identical approved HTTPS Mini App URL. The main-app and menu-button URLs must not accidentally point to different environments.
4. Edit about text via `/setabouttext` (limit 120 characters) and description via `/setdescription` (limit 512 characters). Use the approved launch kit copy; don't promise a token, earnings, withdrawals or multiplayer in v1.
5. Set the profile image via `/setuserpic` using official approved artwork from the locked silhouette master (Telegram may need a platform-compatible rasterization, without changing the mark).
6. Only define `/setcommands` for *actually supported* bot commands; do not invent unsupported `/balance`, `/leaderboard` or other command behavior.
7. Add reviewed, real gameplay screenshots and video previews to the Main Mini App profile only after media and privacy checks.
8. On physical iPhone, test the public bot's Main Mini App, menu-button flow and deep link `https://t.me/GwapoholicsBot?startapp` with a staged test account **after** the official configuration has separately been authorized.
9. Ensure the bot does not expose a default public game command prior to deployment completion; announce only after a signed smoke test.

**No public BotFather setting has been changed by this SOP.**

## Proposed community topology

Create only after verifying handle availability and moderator ownership:

- **Announcement channel** (official operator posts only) for releases, alerts, new stories, poll links.
- **Linked discussion group** for business decisions, fiction-related debate and community feedback.
- **Private beta venue** for consenting iPhone testers, kept separate from the public group; no public access to player bug logs or private identifiers.

Avoid scattering users across multiple inactive chats. Prefer channel + linked group + restricted beta while the audience is small.

## Moderation and support operating procedure

- Name 1 primary and 1 backup moderator; secure their accounts.
- Pin the **official bot** link, educational-fiction/virtual-G notice, rules, anti-scam alert and verified support route.
- Use membership controls, spam filters and a clear message-removal/escalation policy; limit unknown bots/invite links and impersonation.
- Never let moderators solicit Telegram login codes, seed phrases, wallet keys or payments. GWAPOHOLICS v1 has no tradable G token.
- Respond to P0 auth/balance/data-loss claims privately, stop new invitations if needed, notify incident owner and create sanitized GitHub issues with only non-secret reproduction details.
- Do not publicly post individual player scores/balances without explicit, revocable player consent.
- Monitor opening-day confusion and the first-choice funnel, then post a concise weekly community update.

## Channel pinned message (draft)

> Welcome to **GWAPOHOLICS** — **Make the call. Own the consequences.**
>
> Explore fictional business dilemmas, make decisions, see outcomes and learn from your strategy. You start with **1,000 virtual G**. G has **no cash value**, is not a launched cryptocurrency and cannot be redeemed, exchanged or withdrawn.
>
> **Official game:** [insert verified `@GwapoholicsBot` link **only after release approval**].
>
> Respect other players; no spam, impersonation, unsolicited investment solicitations or fake support DMs. Never disclose Telegram login details or wallet recovery phrases. Report bugs through [insert private operator-controlled support route]. [Insert approved Terms and Privacy URLs.]

## Release verification record

| Step | Evidence required | Status |
|---|---|---|
| Bot ownership, operator 2FA | Owner confirmation + redacted screenshot | UNKNOWN |
| Official logo master import | Exact SVG + hash + visual approval | BLOCKED — issue #32 |
| HTTPS production app | Tested immutable deployment SHA, session and DB writes | NOT APPROVED |
| Main Mini App and menu button | Screenshot / URL checked against deployment | NOT CONFIGURED |
| Public profile media | Approved screenshots and teaser | PREPARED, NOT UPLOADED |
| Announcement/group names | Verified ownership and moderation | NOT CREATED/UNVERIFIED |
| Public launch | Founder sign-off, legal and operational gates | NOT AUTHORIZED |

**Dependencies:** [Launch plan](LAUNCH_MASTER_PLAN.md), [marketing kit](MARKETING_LAUNCH_KIT_DRAFT.md), [legal copy](LEGAL_DISCLOSURES_DRAFT.md), [private beta issue #31](https://github.com/gwapupward-hub/GWAPOHOLICS/issues/31), [brand issue #32](https://github.com/gwapupward-hub/GWAPOHOLICS/issues/32).
