`pixel-operator.ttf` is a TrueType conversion of the project's
`public/pixel-operator.woff` (Pixel Operator Mono HB 8 by Jayvee Enaguas,
CC0 / public domain). Converted using the existing development dependency
fonteditor-core; no new runtime dependency is required.

`proportional-italic.ttf` is a CC0 derivative: advances fit glyph widths and
outlines are skewed by 0.2 times their vertical coordinates; head/OS2 mark the
face italic. `pixel-variable.ttf` is another CC0 derivative, with two real
variation axes (wght 400–700 and ital 0–1). Its gvar tuples expand simple glyph
outlines for bold and skew them for italic, including combined styles. Composite
glyphs reference the varying simple glyphs. These fixtures are for tests only.
