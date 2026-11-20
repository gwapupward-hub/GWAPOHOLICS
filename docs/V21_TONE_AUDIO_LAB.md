# Local-only Tone.js Audio Lab

This experiment does not alter the production app or install Tone.js in the game runtime.

## Build and run (developer workstation)

```bash
npm install --no-save tone esbuild
mkdir -p vendor
npx esbuild node_modules/tone/build/esm/index.js --bundle --format=esm --platform=browser --outfile=vendor/tone.mjs
npm run dev
```

Open **http://localhost:4173/audio-lab.html?experiment=audio**. Click **Unlock local audio** to initialize Web Audio. The page makes no third-party script requests; the local bundle is required. Do not commit generated `vendor/tone.mjs` without a dependency/version/license review.

## QA evidence to capture

- Exact Tone.js and esbuild versions and bundle size
- iPhone Telegram WebView audio unlock, silent switch, mute, app background/foreground
- Android Telegram WebView audio unlock, mute, background/foreground
- Latency, CPU/memory impact, missed/overlapping notes
- Accessibility and no-audio fallback
- Verify that production app remains on native Web Audio with the experiment disabled

This lab is localhost-only; remote Preview domains are intentionally locked. Its success does not constitute Telegram device QA or production approval.
