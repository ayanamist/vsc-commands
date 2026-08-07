// Regenerates media/icons/commands-statusbar-icons.woff from the SVG sources.
//
// Run with `npm run build:icon-font` after changing any of the source SVGs.
// The code points below must stay in sync with contributes.icons in package.json.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import svgpath from 'svgpath';
import svg2ttf from 'svg2ttf';
import ttf2woff from 'ttf2woff';

const ICONS = [
  { name: 'opencode', codePoint: 0xf101 },
  { name: 'gemini', codePoint: 0xf102 },
  { name: 'cursor', codePoint: 0xf103 },
  { name: 'copilot', codePoint: 0xf104 },
  { name: 'codex', codePoint: 0xf105 },
  { name: 'claude', codePoint: 0xf106 },
  { name: 'amp', codePoint: 0xf107 }
];

const FONT_FAMILY = 'commands-statusbar-icons';

// Matching codicon's proportions (ascent == em box, no descent) keeps the
// glyphs on the same baseline as built-in icons in the status bar.
const UNITS_PER_EM = 1000;
const ASCENT = UNITS_PER_EM;
const DESCENT = 0;

// Elements that only define reusable or non-painted content. Their children are
// never drawn, so converting them into contours would fill the whole glyph.
const NON_PAINTED_TAGS = new Set([
  'clippath',
  'defs',
  'desc',
  'filter',
  'lineargradient',
  'marker',
  'mask',
  'metadata',
  'pattern',
  'radialgradient',
  'style',
  'symbol',
  'title'
]);

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ICON_DIR = join(ROOT, 'media', 'icons');
const OUTPUT = join(ICON_DIR, `${FONT_FAMILY}.woff`);

const ATTRS = ':@';
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  attributesGroupName: ATTRS,
  preserveOrder: true,
  parseAttributeValue: false
});

function tagOf(node) {
  return Object.keys(node).find((key) => key !== ATTRS);
}

function numberAttr(attrs, name, fallback = 0) {
  const raw = attrs?.[name];
  if (raw === undefined) return fallback;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : fallback;
}

// Filling a polyline closes it, so polygons and polylines convert the same way.
function pointsToPath(raw) {
  const numbers = String(raw ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number.parseFloat)
    .filter(Number.isFinite);
  if (numbers.length < 6) return undefined;
  const steps = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) {
    steps.push(`${i === 0 ? 'M' : 'L'}${numbers[i]} ${numbers[i + 1]}`);
  }
  return `${steps.join(' ')} Z`;
}

function shapeToPath(tag, attrs, source) {
  switch (tag) {
    case 'path':
      return attrs?.d;
    case 'rect': {
      const w = numberAttr(attrs, 'width');
      const h = numberAttr(attrs, 'height');
      if (w <= 0 || h <= 0) return undefined;
      if (attrs?.rx !== undefined || attrs?.ry !== undefined) {
        throw new Error(`${source}: rounded <rect> is not supported, convert it to a <path> first`);
      }
      const x = numberAttr(attrs, 'x');
      const y = numberAttr(attrs, 'y');
      return `M${x} ${y} H${x + w} V${y + h} H${x} Z`;
    }
    case 'circle':
    case 'ellipse': {
      const cx = numberAttr(attrs, 'cx');
      const cy = numberAttr(attrs, 'cy');
      const r = numberAttr(attrs, 'r');
      const rx = tag === 'circle' ? r : numberAttr(attrs, 'rx');
      const ry = tag === 'circle' ? r : numberAttr(attrs, 'ry');
      if (rx <= 0 || ry <= 0) return undefined;
      return `M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
    }
    case 'polygon':
    case 'polyline':
      return pointsToPath(attrs?.points);
    default:
      return undefined;
  }
}

const CURVE_STEPS = 12;

function flatten(pathData) {
  const contours = [];
  let contour;
  let startPoint = [0, 0];

  const cubic = (x0, y0, x1, y1, x2, y2, x3, y3) => {
    for (let step = 1; step <= CURVE_STEPS; step++) {
      const t = step / CURVE_STEPS;
      const u = 1 - t;
      contour.push([
        u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
        u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3
      ]);
    }
  };
  const quadratic = (x0, y0, x1, y1, x2, y2) => {
    for (let step = 1; step <= CURVE_STEPS; step++) {
      const t = step / CURVE_STEPS;
      const u = 1 - t;
      contour.push([
        u * u * x0 + 2 * u * t * x1 + t * t * x2,
        u * u * y0 + 2 * u * t * y1 + t * t * y2
      ]);
    }
  };

  svgpath(pathData)
    .abs()
    .unarc()
    .unshort()
    .iterate((segment, _index, x, y) => {
      const [command] = segment;
      if (command === 'M') {
        startPoint = [segment[1], segment[2]];
        contour = [startPoint];
        contours.push(contour);
        return;
      }
      if (!contour) {
        startPoint = [x, y];
        contour = [startPoint];
        contours.push(contour);
      }
      switch (command) {
        case 'L':
          contour.push([segment[1], segment[2]]);
          break;
        case 'H':
          contour.push([segment[1], y]);
          break;
        case 'V':
          contour.push([x, segment[1]]);
          break;
        case 'C':
          cubic(x, y, segment[1], segment[2], segment[3], segment[4], segment[5], segment[6]);
          break;
        case 'Q':
          quadratic(x, y, segment[1], segment[2], segment[3], segment[4]);
          break;
        case 'Z':
          contour.push([...startPoint]);
          break;
        default:
          throw new Error(`unsupported path command "${command}"`);
      }
    });

  return contours.filter((points) => points.length > 2);
}

function isFilled(contours, px, py, evenOdd) {
  let winding = 0;
  let crossings = 0;
  for (const points of contours) {
    for (let i = 0; i < points.length; i++) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[(i + 1) % points.length];
      if ((y0 > py) === (y1 > py)) continue;
      const side = (x1 - x0) * (py - y0) - (px - x0) * (y1 - y0);
      if (y0 <= py) {
        if (side > 0) winding++;
      } else if (side < 0) {
        winding--;
      }
      if (px < x0 + ((py - y0) / (y1 - y0)) * (x1 - x0)) crossings++;
    }
  }
  return evenOdd ? crossings % 2 === 1 : winding !== 0;
}

function sample(contours, box, resolution, evenOdd) {
  const [minX, minY, maxX, maxY] = box;
  const filled = [];
  for (let row = 0; row < resolution; row++) {
    const y = minY + ((row + 0.5) * (maxY - minY)) / resolution;
    for (let column = 0; column < resolution; column++) {
      const x = minX + ((column + 0.5) * (maxX - minX)) / resolution;
      filled.push(isFilled(contours, x, y, evenOdd));
    }
  }
  return filled;
}

// TrueType only knows the non-zero winding rule. An even-odd outline usually
// survives the conversion untouched, but it does not have to, so compare both
// interpretations before trusting the result.
function assertEvenOddSurvives(pathData, tag, source) {
  const contours = flatten(pathData);
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const points of contours) {
    for (const [x, y] of points) {
      box[0] = Math.min(box[0], x);
      box[1] = Math.min(box[1], y);
      box[2] = Math.max(box[2], x);
      box[3] = Math.max(box[3], y);
    }
  }
  const resolution = 128;
  const evenOdd = sample(contours, box, resolution, true);
  const nonZero = sample(contours, box, resolution, false);
  const mismatched = evenOdd.reduce((total, value, index) => total + (value === nonZero[index] ? 0 : 1), 0);
  if (mismatched > 0) {
    const percent = ((mismatched / evenOdd.length) * 100).toFixed(1);
    throw new Error(
      `${source}: <${tag}> uses fill-rule="evenodd" and renders differently under the non-zero rule ` +
        `(${percent}% of the artwork), so its holes must be redrawn with the opposite winding direction`
    );
  }
}

function collectPaths(nodes, inherited, source, out) {
  for (const node of nodes) {
    const tag = tagOf(node);
    if (!tag || tag === '#text') continue;
    if (NON_PAINTED_TAGS.has(tag.toLowerCase())) continue;

    const attrs = node[ATTRS] ?? {};
    const fill = attrs.fill ?? inherited.fill;
    const fillRule = attrs['fill-rule'] ?? inherited.fillRule;
    const transform = attrs.transform
      ? `${inherited.transform} ${attrs.transform}`.trim()
      : inherited.transform;

    const data = shapeToPath(tag.toLowerCase(), attrs, source);
    if (data && fill !== 'none' && fill !== 'transparent') {
      if (fillRule === 'evenodd') assertEvenOddSurvives(data, tag, source);
      out.push(transform ? svgpath(data).transform(transform).toString() : data);
    }

    const children = node[tag];
    if (Array.isArray(children)) {
      collectPaths(children, { fill, fillRule, transform }, source, out);
    }
  }
}

function readIcon(name) {
  const file = join(ICON_DIR, `${name}-dark.svg`);
  const source = relative(ROOT, file);
  const tree = parser.parse(readFileSync(file, 'utf8'));
  const root = tree.find((node) => tagOf(node) === 'svg');
  if (!root) throw new Error(`${source}: no <svg> element`);

  const attrs = root[ATTRS] ?? {};
  const viewBox = String(attrs.viewBox ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number.parseFloat);
  const [x, y, width, height] =
    viewBox.length === 4 && viewBox.every(Number.isFinite)
      ? viewBox
      : [0, 0, numberAttr(attrs, 'width'), numberAttr(attrs, 'height')];
  if (!(width > 0) || !(height > 0)) throw new Error(`${source}: missing or invalid viewBox`);

  const paths = [];
  collectPaths(root.svg ?? [], { fill: attrs.fill, fillRule: attrs['fill-rule'], transform: '' }, source, paths);
  if (!paths.length) throw new Error(`${source}: no painted shapes found`);

  // Fit the artwork's viewBox into the em square and flip the y axis, since SVG
  // grows downwards while font coordinates grow upwards.
  const scale = UNITS_PER_EM / Math.max(width, height);
  const offsetX = (UNITS_PER_EM - width * scale) / 2;
  const offsetY = (UNITS_PER_EM - height * scale) / 2;
  const matrix = [scale, 0, 0, -scale, offsetX - x * scale, offsetY + (y + height) * scale];

  return svgpath(paths.join(' ')).matrix(matrix).round(1).toString();
}

function buildSvgFont(glyphs) {
  const entries = glyphs
    .map(
      ({ name, codePoint, path }) =>
        `    <glyph glyph-name="${name}" unicode="&#x${codePoint.toString(16)};" d="${path}" />`
    )
    .join('\n');

  return `<?xml version="1.0" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg">
  <defs>
    <font id="${FONT_FAMILY}" horiz-adv-x="${UNITS_PER_EM}">
      <font-face
        font-family="${FONT_FAMILY}"
        units-per-em="${UNITS_PER_EM}"
        ascent="${ASCENT}"
        descent="${DESCENT}" />
      <missing-glyph horiz-adv-x="${UNITS_PER_EM}" />
${entries}
    </font>
  </defs>
</svg>
`;
}

// A glyph that inks most of its em square shows up as a solid block in the
// status bar, which is what happens when clip paths or masks leak into the
// outline, so report the ratio on every build.
function inkCoverage(pathData) {
  const contours = flatten(pathData);
  const filled = sample(contours, [0, 0, UNITS_PER_EM, UNITS_PER_EM], 128, false);
  return filled.filter(Boolean).length / filled.length;
}

const glyphs = ICONS.map(({ name, codePoint }) => {
  const path = readIcon(name);
  return { name, codePoint, path, coverage: inkCoverage(path) };
});

// A fixed timestamp keeps the committed binary stable across rebuilds.
const ttf = svg2ttf(buildSvgFont(glyphs), { description: 'Status bar icons for the Commands extension', ts: 0 });
const woff = ttf2woff(new Uint8Array(ttf.buffer));
writeFileSync(OUTPUT, Buffer.from(woff.buffer, woff.byteOffset, woff.byteLength));

console.log(`${relative(ROOT, OUTPUT)}: ${glyphs.length} glyphs, ${UNITS_PER_EM} units/em`);
for (const { name, codePoint, coverage } of glyphs) {
  const percent = `${(coverage * 100).toFixed(0)}%`.padStart(4);
  console.log(`  U+${codePoint.toString(16).toUpperCase()} ${name.padEnd(9)} ${percent} of the em square inked`);
}
