import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PNG} from 'pngjs';
import {Font} from 'fonteditor-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const inputPath = path.join(repoRoot, 'public', 'pico8-font.png');
const outputPath = path.join(repoRoot, 'public', 'pico8-ui.woff');

const GRID_SIZE = 16;
const SOURCE_CELL_PX = 32;
const NORMALIZED_CELL_PX = 8;
const BLOCK_PX = SOURCE_CELL_PX / NORMALIZED_CELL_PX;
const PIXEL_UNITS = 100;
const CELL_UNITS = NORMALIZED_CELL_PX * PIXEL_UNITS;
const LETTER_SPACING_UNITS = PIXEL_UNITS;
const SPACE_ADVANCE_UNITS = PIXEL_UNITS * 4;

const EXTRA_LATIN = [
  'Á', 'À', 'Â', 'Ã', 'Ä', 'Å', 'á', 'à', 'â', 'ã', 'ä', 'å',
  'É', 'È', 'Ê', 'Ë', 'é', 'è', 'ê', 'ë',
  'Í', 'Ì', 'Î', 'Ï', 'í', 'ì', 'î', 'ï',
  'Ó', 'Ò', 'Ô', 'Õ', 'Ö', 'ó', 'ò', 'ô', 'õ', 'ö',
  'Ú', 'Ù', 'Û', 'Ü', 'ú', 'ù', 'û', 'ü',
  'Ç', 'ç', 'Ñ', 'ñ'
];

const isPixelOn = (r, g, b, a) => a > 0 && (r > 48 || g > 48 || b > 48);

const normalizeChar = (char) => {
  if (/[A-Z]/.test(char)) {
    return char.toLowerCase();
  }

  const latinBase = char.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/^[A-Z]$/.test(latinBase)) {
    return latinBase.toLowerCase();
  }
  if (/^[a-z]$/.test(latinBase)) {
    return latinBase;
  }

  return char;
};

const getAtlasCode = (char) => {
  const normalized = normalizeChar(char);
  return normalized.codePointAt(0) ?? 32;
};

const buildNormalizedMatrix = (png, atlasCode) => {
  const matrix = Array.from({length: NORMALIZED_CELL_PX}, () => Array(NORMALIZED_CELL_PX).fill(false));
  const cellX = (atlasCode % GRID_SIZE) * SOURCE_CELL_PX;
  const cellY = Math.floor(atlasCode / GRID_SIZE) * SOURCE_CELL_PX;

  for (let y = 0; y < NORMALIZED_CELL_PX; y += 1) {
    for (let x = 0; x < NORMALIZED_CELL_PX; x += 1) {
      let on = false;
      for (let sy = 0; sy < BLOCK_PX && !on; sy += 1) {
        for (let sx = 0; sx < BLOCK_PX; sx += 1) {
          const px = cellX + x * BLOCK_PX + sx;
          const py = cellY + y * BLOCK_PX + sy;
          const idx = (py * png.width + px) * 4;
          if (isPixelOn(png.data[idx], png.data[idx + 1], png.data[idx + 2], png.data[idx + 3])) {
            on = true;
            break;
          }
        }
      }
      matrix[y][x] = on;
    }
  }

  return matrix;
};

const buildGlyphFromMatrix = (matrix, name, unicode) => {
  let xMin = NORMALIZED_CELL_PX;
  let xMax = -1;
  let yMin = NORMALIZED_CELL_PX;
  let yMax = -1;
  const contours = [];

  for (let y = 0; y < NORMALIZED_CELL_PX; y += 1) {
    for (let x = 0; x < NORMALIZED_CELL_PX; x += 1) {
      if (!matrix[y][x]) continue;
      xMin = Math.min(xMin, x);
      xMax = Math.max(xMax, x);
      yMin = Math.min(yMin, y);
      yMax = Math.max(yMax, y);

      const left = x * PIXEL_UNITS;
      const right = left + PIXEL_UNITS;
      const top = CELL_UNITS - y * PIXEL_UNITS;
      const bottom = top - PIXEL_UNITS;
      contours.push([
        {x: left, y: bottom, onCurve: true},
        {x: left, y: top, onCurve: true},
        {x: right, y: top, onCurve: true},
        {x: right, y: bottom, onCurve: true}
      ]);
    }
  }

  if (xMax < xMin) {
    return {
      contours: [],
      xMin: 0,
      yMin: 0,
      xMax: 0,
      yMax: 0,
      advanceWidth: SPACE_ADVANCE_UNITS,
      leftSideBearing: 0,
      name,
      unicode
    };
  }

  const glyphWidth = (xMax - xMin + 1) * PIXEL_UNITS;
  const leftSideBearing = xMin * PIXEL_UNITS;
  const advanceWidth = Math.min(CELL_UNITS, leftSideBearing + glyphWidth + LETTER_SPACING_UNITS);

  return {
    contours,
    xMin: leftSideBearing,
    yMin: (NORMALIZED_CELL_PX - yMax - 1) * PIXEL_UNITS,
    xMax: (xMax + 1) * PIXEL_UNITS,
    yMax: CELL_UNITS - yMin * PIXEL_UNITS,
    advanceWidth,
    leftSideBearing,
    name,
    unicode
  };
};

const buildUnicodeMap = () => {
  const grouped = new Map();
  for (let code = 32; code <= 126; code += 1) {
    const char = String.fromCharCode(code);
    const atlasCode = getAtlasCode(char);
    const list = grouped.get(atlasCode) ?? [];
    list.push(code);
    grouped.set(atlasCode, list);
  }

  for (const char of EXTRA_LATIN) {
    const atlasCode = getAtlasCode(char);
    const code = char.codePointAt(0);
    if (code == null) continue;
    const list = grouped.get(atlasCode) ?? [];
    if (!list.includes(code)) {
      list.push(code);
    }
    grouped.set(atlasCode, list);
  }

  return grouped;
};

const main = () => {
  const png = PNG.sync.read(fs.readFileSync(inputPath));
  const font = Font.create();
  font.readEmpty();
  const data = font.get();
  const unicodeMap = buildUnicodeMap();

  data.glyf = [data.glyf[0]];
  for (const [atlasCode, unicodes] of unicodeMap.entries()) {
    const matrix = buildNormalizedMatrix(png, atlasCode);
    data.glyf.push(buildGlyphFromMatrix(matrix, `uni${atlasCode.toString(16)}`, unicodes));
  }

  data.name.fontFamily = 'TinyRpgPico8';
  data.name.fontSubFamily = 'Regular';
  data.name.uniqueSubFamily = 'Tiny RPG Studio Bitmap UI Font';
  data.name.fullName = 'TinyRpgPico8';
  data.name.postScriptName = 'TinyRpgPico8';
  data.name.version = 'Version 1.0';

  data.head.unitsPerEm = CELL_UNITS;
  data.head.xMin = 0;
  data.head.yMin = 0;
  data.head.xMax = CELL_UNITS;
  data.head.yMax = CELL_UNITS;
  data.head.lowestRecPPEM = 8;

  data.hhea.ascent = CELL_UNITS;
  data.hhea.descent = 0;
  data.hhea.lineGap = PIXEL_UNITS * 2;
  data.hhea.advanceWidthMax = CELL_UNITS;

  data['OS/2'].usWinAscent = CELL_UNITS;
  data['OS/2'].usWinDescent = 0;
  data['OS/2'].sTypoAscender = CELL_UNITS;
  data['OS/2'].sTypoDescender = 0;
  data['OS/2'].sTypoLineGap = PIXEL_UNITS * 2;
  data['OS/2'].sxHeight = CELL_UNITS;
  data['OS/2'].sCapHeight = CELL_UNITS;
  data['OS/2'].usFirstCharIndex = 32;
  data['OS/2'].usLastCharIndex = 255;

  data.post.isFixedPitch = 0;

  font.set(data);
  font.optimize();
  const buffer = font.write({type: 'woff', toBuffer: true, hinting: false, kerning: false});
  fs.writeFileSync(outputPath, buffer);
  console.log(`Generated ${path.relative(repoRoot, outputPath)}`);
};

main();
