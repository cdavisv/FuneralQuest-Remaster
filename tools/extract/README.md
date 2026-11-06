# @fq/extract

Converts the original Flash 5 art in `legacy/dist/public/flash/**/*.swf` into standalone SVG files, a manifest and reference documents. Written in TypeScript with its own SWF parser (no JPEXS, no downloaded binaries). Runtime dependencies on the machine: `rsvg-convert` (used to verify every SVG and to render the contact sheet PNGs).

## Run

```
pnpm --filter @fq/extract run export     # about 30 s
pnpm --filter @fq/extract test
pnpm --filter @fq/extract typecheck
```

The export writes to a staging folder, checks that every SVG renders with `rsvg-convert`, and only then replaces `assets/classic/`. If any SWF cannot be converted, or any SVG fails to render, it prints the failures, exits 1 and leaves the previous `assets/classic/` untouched.

## Outputs

| Path                                                                                | Content                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assets/classic/<id>.svg`                                                           | Frame 1 of every picture SWF, viewBox `0 0 550 400`, transparent background. Ids follow the rule in `CLAUDE.md` (`Ring/` becomes `ring/`).                                                                                                                                                                                    |
| `assets/classic/<id>.frames/0001.svg ...`                                           | Every frame of animated pictures. Movies with several root frames export those; one-frame movies animated by a sprite export the longest sprite loop (capped at 150).                                                                                                                                                         |
| `assets/classic/ui/*.svg`                                                           | About 67 named UI pieces from `welcome.swf` (cabinet, parchment, picture frame, plaque buttons, scroll capsule and icons, coffin tags, Deathville map, nine buildings, newspaper, notepad, login plaque, clerk, skulls, rankings skeleton, dialogs). Cropped to their content; the origin is the original registration point. |
| `assets/classic/ui/screens/*.svg`                                                   | Composed reference screens, one per frame label (root timeline and the sub-screen sprites). Dynamic text fields are dashed boxes.                                                                                                                                                                                             |
| `assets/classic/ui/parts/*.svg`                                                     | Every other shape, sprite and button of `welcome.swf`, named by id, so nothing is lost.                                                                                                                                                                                                                                       |
| `assets/classic/ui/textures/*.jpg`                                                  | The three embedded JPEGs: `brick`, `river`, `gravel`.                                                                                                                                                                                                                                                                         |
| `assets/manifest.json`                                                              | One entry per asset (id, source, category, viewBox, frame count and rate, bitmaps, credit, license, `needsRedraw`) plus the `legacyUrl` map from every URL spelling the server uses to an id. `frameCount` is the exported animation length; `swfFrameCount` is the SWF's own.                                                |
| `assets/classic/contact-sheet.html`, `contact-sheet.png`, `contact-sheet-parts.png` | Review sheets with ids.                                                                                                                                                                                                                                                                                                       |
| `docs/reference/`                                                                   | `welcome-actionscript.md` (decompiled AS1), `welcome-texts-and-fonts.md`, `welcome-structure.md` (labels and sprites), `sound-inventory.md` (metadata only).                                                                                                                                                                  |

No audio data is written anywhere. `music/*.swf` appear in the manifest as `audio-only` with no file.

## How it works

`swf.ts` parses tags (shapes, morph shapes, sprites, buttons, static and edit text, fonts, JPEG, sounds, place/remove with clip actions). `timeline.ts` replays display lists and models sprite playback (loops, `stop()`). `render.ts` flattens everything to absolute pixel coordinates: even-odd fills per style, gradients, bitmap patterns, colour transforms, clip layers (`clipDepth` becomes `clipPath`), morph interpolation, glyph outlines for static text, `<text>` for text fields. A quarter-pixel overpaint on edges shared by two fills hides antialiasing hairlines. SVGO then minifies (checked as pixel-identical). `as1.ts` is a stack-simulating AS1 decompiler with if/else, while and do-while folding.

UI piece names live in `src/ui.ts` (`PIECES`); they were identified from renders and from button actions in the decompiled script. The `needsRedraw` list and reasons live in `src/manifest.ts`.

## Known gaps

- Only the first frame state of each sprite is exact for scripted behaviour: script-driven `gotoAndPlay`, `_visible` changes and dynamic text are not emulated, except that sprites which hide themselves in frame 1 are hidden in composed screens, and a fixed list of dialog overlays is hidden.
- Text fields draw their initial text with a generic font family; the embedded fonts are not reused for fields. Fields without initial text are not drawn (markers only appear in screens).
- Thin gaps can remain between abutting translucent shapes (for example the halo rays of `people/jesus_happy`).
- Strokes are clamped to 0.5 px minimum and scale with the placement; Flash hairlines would stay 1 device pixel.
- Bitmap fills are always tiled (clamped fills are rare); lossless and alpha bitmaps, DefineShape4 and later tags are rejected loudly (none occur in the files).
- The decompiler can leave a `goto` in deeply nested else-if chains (one in `welcome.swf`), and prints slash-syntax variables as written.
- Frame SVGs are large (about 31 MB of the 44 MB in `assets/classic`).
