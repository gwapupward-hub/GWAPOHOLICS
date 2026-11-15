# Sprint 3 — Preview ingress verification

This test is **not yet executed**. The script is intentionally opt-in and bounded to 22 requests, with no Telegram credentials. It must be run only after checking the URL is a Preview deployment in Vercel (a `.vercel.app` hostname alone does not prove Preview).

## Operator procedure
1. In Vercel, verify the exact deployment is `target: null` (Preview), and its linked project is `gwap-telegram-business-sim`. Check the deployment SHA and URL.
2. Use a dedicated source IP; ensure other testers are not using it. Do not run from shared office or mobile carrier NAT.
3. Wait 60 seconds without sending other session requests from that IP.
4. Run:
   `GWAP_PREVIEW_URL=https://YOUR-VERIFIED-PREVIEW.vercel.app GWAP_WAF_TEST_CONFIRM=PREVIEW_ONLY node scripts/verify-preview-waf.mjs`
5. Observe 429 within 22 POSTs, then inspect the Vercel firewall event for attribution to the active session IP rule. If 429 is not observed, mark inconclusive; do not increase load.
6. Wait 60+ seconds and use the test bot to confirm legitimate authenticated launch works again.
7. Record UTC time, deployment ID, status sequence, firewall event ID (if available), and pass/fail. Never record credentials.

**Caution:** Invalid request payloads may be rejected by application validation before WAF triggers. A 429 from another component is not proof of the configured WAF rule. A preview protected by Vercel Authentication may reject the test before the app. Stop and investigate rather than bypassing protection.

No production deployment, firewall configuration change or tester invitation is authorized by this document.
