Original prompt: estou migrando para uma nova fonte, que é uma imagem, pico8, então a fonte é um bitmap, o processo de migração esta pela metade, continua a migração até que 100% de tudo da engine serja usando a nova fonte, tire prints pra validar

Progress:
- Found partial bitmap font migration in runtime renderers and share cover preview.
- Source runtime no longer has direct canvas `fillText`, `strokeText`, `ctx.font =`, or `ctx.measureText` usage outside tests.
- Bitmap font now redraws the game and share-cover preview after `pico8-font.png` finishes loading.
- Focused renderer tests pass: 151 tests across dialog, floating text, entity, overlay, and renderer suites.
- Full test suite passes: 1664 tests across 114 files.
- `npm run build:export` passed and regenerated `public/export.bundle.js`.
- Screenshot validation caught wrong glyph mapping during migration.
- Atlas inspection confirmed the image is a 16x16 grid with 32px source cells; each cell is normalized to an 8x8 internal glyph before rendering.
- Loader now normalizes the 512px atlas to a 128px internal sheet by downscaling each 32px source cell into an 8x8 glyph before tinting/rendering.
- Offset sampling confirmed this `pico8-font.png` uses direct ASCII code indexes, so lookup now uses `charCode` with no `-16` shift.
- Web research confirmed PICO-8/P8SCII uses 256 glyphs and `print()` advances ASCII-range glyphs at 4px while extended glyphs use 8px, so `BitmapFont.measureText()` and wrapping now use those metrics.
- Intro title irregularity was caused by mixing case and fractional bitmap scaling; bitmap text now normalizes to the PICO-8 lowercase code range, uses integer sizes in the intro, and uses a compact atlas advance without cutting glyphs.
- Intro overlay text now fits to available width to avoid clipping with the bitmap font.
- Final screenshot validation captured a legible intro, gameplay, and moved gameplay in `output/bitmap-font-validation/index.html`.

TODO:
- No known bitmap font migration TODOs left.
