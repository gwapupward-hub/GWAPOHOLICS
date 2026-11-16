# GWAPOHOLICS — Player Disclosures & Legal Publishing Checklist (DRAFT / NOT LIVE)

**Status:** Internal working draft for founder/legal review only. Do not publish it as an approved Terms of Service or Privacy Policy. It is not a representation that the application currently implements every described right or retention procedure.

## Player-facing short disclosure (draft)

> GWAPOHOLICS is a fictional, educational business simulation delivered through a Telegram Mini App. Decisions change an in-game virtual G balance; they do not determine your real investment outcome. **Virtual G is not cryptocurrency or money, has no cash value, cannot be withdrawn, transferred, redeemed or exchanged, and no Solana token is currently launched.** Do not make financial decisions based solely on game content.

## Suggested first-use rules (draft)

- You begin with **1,000 virtual G**.
- Decisions may earn or lose virtual G according to the game's rules.
- Missions are restricted when the balance drops below **100 G**. Limited educational recovery follows the rules/cooldown displayed in the app.
- Your Telegram identity is used to associate the Mini App session with game progress; the server keeps the authoritative balance, game state and transaction records.
- Game stories are invented for education and entertainment. Historical or business analogies do not guarantee outcomes.
- Do not share Telegram login codes, session data, wallet seed phrases or credentials with anyone claiming to be support.

## Terms of Service — clauses to draft and approve

1. **Operator/legal entity**: confirm official operator legal name, jurisdiction, support contact and effective date.
2. **Eligibility**: decide and publish a legally reviewed minimum age, parental-consent requirements and geographic restrictions; do not invent an age threshold.
3. **Service**: a Telegram Mini App providing fictional decision-based educational gameplay, not professional financial, legal or investment advice.
4. **Virtual G**: purely in-game point unit, no real currency, no ownership interest or transferable asset, no withdrawals, exchange, redemption or guaranteed value.
5. **Game fairness**: rules governing starting balance, settlement, below-100 lockout, cooldown, progress and reasonable changes to an in-game economy.
6. **User conduct**: no exploitation, multi-account farming, bot abuse, harassment, fraud, platform manipulation or unauthorized access.
7. **Account/data**: Telegram identity, saved progress, foreseeable account deletion and how it interacts with backup and dispute records.
8. **Availability and changes**: service interruptions, update practices, consequences of reset/maintenance and incident communication.
9. **IP/brand**: gameplay, graphics and locked GWAPOHOLICS mark; user feedback license should be narrow, explicit and reviewed.
10. **Legal limitations and disputes**: jurisdiction-specific consumer law, liability/indemnity clauses and notices require local counsel review.

## Privacy Policy — required evidence before writing final claims

| Data/process | What we know from the v1 implementation | What needs explicit confirmation |
|---|---|---|
| Telegram identity | Server verifies Telegram `initData`; persisted records keyed to Telegram user ID | Whether display name/photo or other Telegram fields are stored anywhere |
| Game state | PostgreSQL stores player balance/state, completed quest runs, virtual ledger, idempotency receipts | Retention period, inactivity policy and account removal process |
| Sessions | Signed HttpOnly secure cookies, short lifetime | Cookie disclosures, logs and exact deletion/revocation behavior |
| Hosting | Vercel Preview and Neon Postgres; encrypted B2 offsite backups for Preview | Production providers, data locations, backup retention and restoration proof |
| Analytics | Acquisition, completion and retention instrumentation **proposed**, not proven deployed | Event payloads, lawful basis/consent, provider, opt-out policy and retention |
| Community | Proposed Telegram announcement/group/beta channels, not confirmed live | Moderation data, responsible administrators and reporting retention |
| Contact/support | Support flow planned | A real monitored address or bot/Telegram support channel |

**Do not assert “we collect no personal data,” “we never share data,” “all data is end-to-end encrypted,” or “data is automatically erased” without an audit.** Do not publish a finished privacy policy without accurate facts and jurisdictional review.

## Internal privacy and security tasks

- [ ] Approve operational identity, legal jurisdiction and support contact.
- [ ] Approve eligibility/age policy.
- [ ] Audit all persistence, logging, Telegram data fields, cookies, external services and backups.
- [ ] Define user deletion/request processing and backup handling; prove workflow in isolated test.
- [ ] Determine data retention, access control, processors and international transfers as applicable.
- [ ] Publish accessible Terms and Privacy URLs before beta/public promotion as appropriate.
- [ ] Add privacy-safe error reporting, support moderation and incident notification practice.
- [ ] Confirm whether any paid feature will exist; no paid virtual currency or real-value claims at v1.

## Telegram app copy — FAQ (draft)

**Is G real money or a cryptocurrency?** No. G is a virtual game balance only and cannot be traded, transferred or withdrawn.

**Does GWAPOHOLICS provide investment advice?** No. The scenarios are fictional educational entertainment.

**Why do I start with 1,000 G?** It gives every new player an in-game starting balance for making business decisions.

**What happens if I go below 100 G?** Regular missions lock until you satisfy the in-game limited educational recovery conditions.

**How is progress saved?** Signed Telegram session + server-controlled database records connect game state to your Telegram identity; your browser is not allowed to assign its own balance.

**Where can I report a problem or request information about my data?** [Official support contact — must be confirmed and monitored before publishing].

## Approval boundary

No final legal text, publication, live payment configuration, BotFather changes, official domain routing or production release is authorized by this document. Founder and qualified counsel should review wording before publication.
