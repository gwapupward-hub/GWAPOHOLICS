# GWAPOHOLICS v2.1 — Player Settings Menu (Preview)

## Scope and placement

This change builds on the unmerged Cinematic Audio & Haptics PR #52. It is a stacked, presentation-focused follow-up and must not merge to production independently of its audio dependency.

- Header settings button is visible on non-cinematic pages; Player Profile has a Settings shortcut.
- Settings page controls background music, effects, haptics, optional in-game notices, and music/effects volumes.
- Privacy page provides a hide standard header balance preference, plus clear Preview information about authentication and storage.
- Terms & Conditions page is a Preview informational overview, NOT final legally approved Terms of Service. Complete production legal notices and a user rights/data request process before launch.
- Logout is exposed only for authenticated Telegram Mini App players and sends a CSRF-protected same-origin POST to the existing /api/logout endpoint to expire the signed HttpOnly cookie. The user must confirm the action.
- A persisted signed-out UI flag prevents automatic immediate reauthentication on reload, until a player explicitly taps "Sign in with Telegram" and authentication succeeds.
- Logout does NOT delete game records, remove Telegram account access, switch Telegram identities, or erase local demo saves.

## Notification semantics

The 'In-game notifications' switch controls only optional notices. Essential gameplay/network errors always remain visible. The switch does NOT request Telegram bot write access, schedule messages, or suppress any externally managed Telegram chat notifications. Those require a separate explicit opt-in and server-authoritative notification settings/delivery design.

## Preferences, security and privacy

The local player preference record contains only booleans for optional notices and header balance display. Audio preferences use the existing sensory controller and guarded Telegram DeviceStorage/localStorage fallback. No new database tables, personally identifying information, authentication tokens, Telegram initData, or G ledger values are stored in these settings.

The hide balance switch conceals ONLY the standard top-bar amount, not the virtual balance in results, Story Mode, the game ledger, or network responses. It is a convenience display preference, not anonymity or data access control.

This Preview contains no data export/deletion endpoint or finalized public Privacy Policy. Do not market either as implemented.

## QA checklist (prior to owner approval)

- [ ] Verify settings button/profile entry on small iOS Telegram screens and Preview desktop demo.
- [ ] Verify all three audio toggles and both volume controls update actual sensory playback and persist after restart.
- [ ] Verify changing notifications disables only optional post-mission notices; errors remain readable.
- [ ] Verify privacy header balance toggle persists and does not alter ledger, game state or game progress.
- [ ] Verify logout confirmation Cancel and Confirm paths. When confirmed, cookie clears; signed-out state survives refresh; explicit re-login restores server progress.
- [ ] Verify failed logout leaves authenticated state intact, with an actionable error.
- [ ] Verify keyboard, VoiceOver, focus order, Native Telegram Back Button, and the confirmation dialog.
- [ ] Check 320px viewport, tall/short viewport, reduced-motion preference, 200% zoom, and Android WebView when available.
- [ ] Obtain owner/legal approval for final policies before public deployment.

Run npm run check and npm test. This feature does not authorize a production deployment, backend migration, or merging PR #52.

## Known Preview sign-in environment gate

The isolated Vercel project `gwapoholics-tests` currently has a branch-restricted `DATABASE_URL` for a **different recovery-testing branch**, not for `feature/v2-1-player-settings-menu`. The settings Preview therefore serves the HTML but its `GET /api/game` returns HTTP 503 (`game_service_unavailable`). Telegram credentials cannot by themselves repair this.

Do not silently reuse a production database or move restored data to solve the sign-in problem. The owner must choose or authorize an isolated, correctly migrated Preview database for the feature branch, confirm that `TELEGRAM_BOT_TOKEN` belongs to the bot that launches the Mini App, and ensure a stable Preview origin is actually configured in BotFather. Until then, authenticated play on this Preview is gated. The client reports the game-service failure separately from a Telegram signature error.

## Telegram test-bot sign-in and fullscreen (2026-11-19)

- Bot identity was checked temporarily using Telegram's getMe response from the Preview server, without recording or returning the bot token. The shared Preview TELEGRAM_BOT_TOKEN belongs to GwapRecovery_bot rather than TestGwap_bot. It **must not** be replaced globally: create a second sensitive TELEGRAM_BOT_TOKEN Vercel environment variable, target Preview, scoped to the Git branch feature/v2-1-player-settings-menu, using the actual token for TestGwap_bot from BotFather.
- Vercel must be redeployed *after* setting that branch-scoped secret; existing Preview deployments do not inherit later environment changes. The temporary bot-identification API was deleted from the final branch code.
- The Preview's isolated Neon DATABASE_URL remains scoped only to the same feature branch and contains the preserved snapshot. The bot token alone does not change any database records.
- Telegram fullscreen now tracks safeAreaInset and contentSafeAreaInset and reacts to viewport, safe-area, and fullscreen events. Regular menus reserve clearance for the Telegram status bar / floating close menu, while cinematic scene art remains edge-to-edge with its controls in the safe region.
- Recheck on a physical iPhone in fullscreen Telegram, including narrator, decision buttons, login/error states, volume controls, signed-out screen and bottom navigation. Browser WebKit tests are supplementary, not a substitute.
