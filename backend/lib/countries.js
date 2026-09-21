const fs = require("fs");
const path = require("path");

// Static boundary source. Geoapify's Boundaries API is built around
// look-ups for a single place ("consists-of" / "part-of" a place_id) rather
// than "give me every country in a continent" in one call, so for a
// continent-wide choropleth we bundle a real Africa country-boundary
// GeoJSON once and treat Geoapify as the basemap/tiles + geocoding layer.
// Swap this file for a live fetch + on-disk cache if you'd rather pull
// boundaries from Geoapify per place_id at startup.
const DATA_PATH = path.join(__dirname, "..", "data", "africa.geojson");

let _collection = null;

function normalize(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // strip accents
}

// A few common aliases so callers can send the name they already have
// (e.g. from Geoapify's Geocoding API, the UN, or their own dataset)
// without needing to match this file's exact spelling.
const ALIASES = {
  "ivory coast": "cote d'ivoire",
  "cape verde": "cabo verde",
  "dr congo": "democratic republic of the congo",
  drc: "democratic republic of the congo",
  congo_kinshasa: "democratic republic of the congo",
  "congo-brazzaville": "republic of the congo",
  "the gambia": "gambia",
  eswatini: "swaziland",
  "swaziland ": "swaziland",
};

function load() {
  if (_collection) return _collection;

  const raw = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  const byName = new Map();

  raw.features.forEach((feature, index) => {
    const name = feature.properties && feature.properties.name;
    if (!name) return;
    feature.properties.id = feature.properties.id || `country-${index}`;
    byName.set(normalize(name), feature);
  });

  _collection = { featureCollection: raw, byName };
  return _collection;
}

function findFeature(nameOrKey) {
  const { byName } = load();
  const key = normalize(nameOrKey);
  const resolved = ALIASES[key] || key;
  return byName.get(resolved) || byName.get(key) || null;
}

function listNames() {
  const { featureCollection } = load();
  return featureCollection.features
    .map((f) => f.properties.name)
    .sort((a, b) => a.localeCompare(b));
}

module.exports = { load, findFeature, listNames, normalize };
