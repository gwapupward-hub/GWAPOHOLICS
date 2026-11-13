# Scene asset pipeline

Approved direction: cinematic 2.5D arcade-business storytelling, near-black stage, green `#13DD13`, restrained orange and purple accents.

**Adobe Firefly board:** https://firefly.adobe.com/boards/id/urn:aaid:sc:US:32f3155f-9932-4f18-a211-0ea55372e883

The board currently holds 13 items: 9 generated visual scenes for `streaming-pivot` and 4 character concepts. The art direction is approved. **Board-only links are not production asset URLs.** Download/export masters to a controlled static assets directory or CDN first. Do not hotlink temporary Adobe presigned URLs.

## Target file convention

```text
public/assets/scenes/streaming-pivot/
  intro.webp
  decision-01.webp
  decision-02.webp
  decision-03.webp
  decision-04.webp
  result-strong.webp
  result-steady.webp
  result-rough.webp
  result-collapse.webp
public/assets/characters/
  gwap-o/
  advisor/
  market-force/
  future-you/
```

Use the same `intro`, `decision-01..04`, `result-<band>` pattern for:
`brand-backlash`, `supply-shock`, `founder-runway`, and `inflation-trap`.

- Originals: retain non-destructive masters with provenance.
- Runtime: optimized WebP/AVIF, visual integrity checked, sensible mobile widths. Serve responsive variants when useful.
- Speakers: transparent cropped PNG/WebP or animation source separate from scene; preserve recognizable GWAP-O across expressions.
- Keep dialogue outside images. Do not bake numbers, decision labels, or score hints into imagery.
- Provide reserved image dimensions and preloading to prevent layout shift. Respect reduced motion.
- Verify approval, export availability, asset licensing, and actual deployment paths before enabling live.
- Work in isolated preview deployments until founder approves public release.

## Cinematic Sprint 1 export status

The nine approved Streaming Pivot illustrations and four character concept images were ingested from Adobe as compact JPEG files and committed as binary Git blobs. These are **real, checked-in image files**, not temporary Adobe links.

Image paths for `streaming-pivot` use `.jpg`; the remaining quests keep reserved `.webp` paths until their artwork is exported.

Sprint 1A adds a WebP variant (quality 78) next to every JPG; Story Mode serves WebP through `<picture>` and keeps the JPG fallback. Retain original artwork in Adobe.

The character concepts are currently raster portraits rather than transparent cutouts; Story Mode shows them with a soft radial mask. Set `cutout` in `CHARACTER_ART` (story-runtime.mjs) when transparent exports exist.

The gallery of source art remains [in Adobe Firefly](https://firefly.adobe.com/boards/id/urn:aaid:sc:US:32f3155f-9932-4f18-a211-0ea55372e883).
