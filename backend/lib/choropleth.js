const { geoPath, geoMercator, geoNaturalEarth1 } = require("d3-geo");
const { extent } = require("d3-array");
const { scaleSequential, scaleQuantize } = require("d3-scale");
const scaleChromatic = require("d3-scale-chromatic");
const { load, findFeature } = require("./countries");

const PROJECTIONS = {
  mercator: geoMercator,
  naturalEarth: geoNaturalEarth1,
};

const PALETTES = {
  blues: scaleChromatic.interpolateBlues,
  oranges: scaleChromatic.interpolateOranges,
  greens: scaleChromatic.interpolateGreens,
  viridis: scaleChromatic.interpolateViridis,
  sand: (t) => interpolateHex("#f6ead9", "#b5651d", t), // warm ochre, no data fallback color
  teal: (t) => interpolateHex("#e6f7f6", "#0f5e5a", t),
};

function hexToRgb(hex) {
  const m = hex.replace("#", "");
  const bigint = parseInt(m, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

function interpolateHex(a, b, t) {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bch = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${bch})`;
}

/**
 * Attach a value + fill color to every feature that has a match in `values`.
 * Unmatched countries get `noDataFill`.
 *
 * @param {Object} opts
 * @param {Record<string, number>} opts.values - keyed by country name (case-insensitive)
 * @param {"blues"|"oranges"|"greens"|"viridis"|"sand"|"teal"} [opts.palette]
 * @param {number} [opts.steps] - quantize into N discrete classes instead of a smooth ramp
 * @param {string} [opts.noDataFill]
 */
function styleFeatures({ values, palette = "blues", steps, noDataFill = "#e7e9ec" }) {
  const { featureCollection } = load();
  const colorFn = PALETTES[palette] || PALETTES.blues;

  const numericValues = Object.values(values).filter((v) => typeof v === "number" && !Number.isNaN(v));
  const [min, max] = numericValues.length ? extent(numericValues) : [0, 1];

  const scale = steps
    ? scaleQuantize()
        .domain([min, max])
        .range(Array.from({ length: steps }, (_, i) => colorFn(i / Math.max(steps - 1, 1))))
    : scaleSequential(colorFn).domain([min, max]);

  const matched = [];
  const unmatched = [];

  const styled = {
    type: "FeatureCollection",
    features: featureCollection.features.map((feature) => {
      const name = feature.properties.name;
      const value = Object.prototype.hasOwnProperty.call(values, name)
        ? values[name]
        : lookupByAnyKey(values, name);

      const hasValue = typeof value === "number" && !Number.isNaN(value);
      if (hasValue) matched.push(name);

      return {
        ...feature,
        properties: {
          ...feature.properties,
          value: hasValue ? value : null,
          fill: hasValue ? scale(value) : noDataFill,
        },
      };
    }),
  };

  const matchedSet = new Set(matched.map((n) => n.toLowerCase()));
  Object.keys(values).forEach((k) => {
    if (!matchedSet.has(k.toLowerCase()) && !findFeature(k)) unmatched.push(k);
  });

  return { styled, domain: [min, max], unmatchedKeys: unmatched };
}

function lookupByAnyKey(values, featureName) {
  const feature = findFeature(featureName);
  if (!feature) return undefined;
  // also allow the caller's key to be an alias that resolves to this feature
  for (const key of Object.keys(values)) {
    const match = findFeature(key);
    if (match && match.properties.name === feature.properties.name) return values[key];
  }
  return undefined;
}

/**
 * Render a standalone choropleth SVG string for the given values.
 */
function renderSVG({
  values,
  palette = "blues",
  steps,
  noDataFill = "#e7e9ec",
  width = 900,
  height = 900,
  projection = "naturalEarth",
  stroke = "#ffffff",
  strokeWidth = 0.6,
  background = "none",
  title,
}) {
  const { styled, domain } = styleFeatures({ values, palette, steps, noDataFill });

  const proj = (PROJECTIONS[projection] || geoNaturalEarth1)();
  proj.fitSize([width, height], styled);
  const path = geoPath(proj);

  const paths = styled.features
    .map((f) => {
      const d = path(f);
      if (!d) return "";
      const label = escapeXml(f.properties.name);
      const valueLabel = f.properties.value === null ? "no data" : f.properties.value;
      return `<path d="${d}" fill="${f.properties.fill}" stroke="${stroke}" stroke-width="${strokeWidth}"><title>${label}: ${valueLabel}</title></path>`;
    })
    .join("\n");

  const heading = title ? `<text x="16" y="28" font-family="system-ui, sans-serif" font-size="20" fill="#1a2027">${escapeXml(title)}</text>` : "";
  const bg = background !== "none" ? `<rect x="0" y="0" width="${width}" height="${height}" fill="${background}"/>` : "";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
${bg}
<g>${paths}</g>
${heading}
</svg>`;

  return { svg, domain };
}

function escapeXml(str) {
  return String(str).replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));
}

module.exports = { styleFeatures, renderSVG };
