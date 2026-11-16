# GWAPOHOLICS — Official Logo Master Lock

**Approved master asset:** `GWAPOHOLICS_512_single_path.svg` (root)  
**SHA-256:** `cd9243dca3e76f71f9e567aa0401a04300c0268a0d0b4cd655419437e58af7cf`  
**Source:** Founder-provided original SVG; imported without changing its geometry, style, text, fill, or viewBox.  
**Byte length:** 3,980 bytes.  
**Vector contract:** Transparent `512×512` canvas with `viewBox="0 0 512 512"`, exactly one black `#000000` `<path>`, no rectangles, gradients, text, external assets or additional paths.

## Repository integration

- The root SVG is the **canonical, immutable master**.
- Existing app favicon `brand.svg` is byte-identical to the canonical master; `index.html` still references `brand.svg`, so browser and Telegram Mini App favicon update without introducing a new icon path.
- `tests/official-logo.test.mjs` requires the original SHA-256, exact byte count, one-path contract and byte-identical favicon. An intentional brand identity change requires separate founder approval and a corresponding reviewed test update.

## Export / display

Telegram bot profile media and other raster-only surfaces may receive format-only renders **from the canonical master**. Keep path geometry and black fill unchanged. Use a contrasting **external container or canvas** where necessary for legibility; do not insert a background element into the canonical transparent SVG. Generated raster exports should be visually inspected at `32×32`, `64×64` and `512×512` before uploading.

## Production controls

- This PR changes only GitHub asset and app favicon, **not** BotFather profile, bot username, Mini App URL, production domain, onchain identity or public release.
- Obtain separate verified access to [@GwapoholicsBot](https://t.me/GwapoholicsBot) before owner-side profile changes.
- Verify that [@TestGwap_bot](https://t.me/TestGwap_bot) currently points to the authenticated Preview branch alias, not demo mode or production. A Telegram bot link alone does not disclose the configured Main Mini App target.
- Do not announce the production game until the founder signs the frozen staging build, security, backup restore, legal and launch gates.

Tracked by [brand issue #32](https://github.com/gwapupward-hub/GWAPOHOLICS/issues/32) and [final production gate #34](https://github.com/gwapupward-hub/GWAPOHOLICS/issues/34).
