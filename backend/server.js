require("dotenv").config();
const express = require("express");
const cors = require("cors");

const { load, listNames } = require("./lib/countries");
const { renderSVG, styleFeatures } = require("./lib/choropleth");
const { tileUrl, vectorStyleUrl, geocode } = require("./lib/geoapify");
const points = require("./lib/points");

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static("public"));

const PORT = process.env.PORT || 4000;

// ---- Map config -----------------------------------------------------------
// Frontend calls this once on load to get a tile URL with the API key
// already attached, so the key never has to live in client-side JS source.
app.get("/api/map-config", (req, res) => {
  try {
    res.json({
      tileUrl: tileUrl(req.query.style),
      vectorStyleUrl: vectorStyleUrl(req.query.style),
      center: [20.0, 2.0], // roughly the centroid of continental Africa
      zoom: 3,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Boundaries -------------------------------------------------------------
app.get("/api/countries", (req, res) => {
  res.json({ names: listNames() });
});

app.get("/api/boundaries", (req, res) => {
  const { featureCollection } = load();
  res.json(featureCollection);
});

// ---- Choropleth -------------------------------------------------------------
// POST body:
// {
//   "values": { "Kenya": 92, "Nigeria": 226, "Egypt": 103, ... },
//   "palette": "blues" | "oranges" | "greens" | "viridis" | "sand" | "teal",
//   "steps": 5,                 // optional: discrete classes instead of a smooth ramp
//   "format": "svg" | "geojson" // default "svg"
// }
app.post("/api/choropleth", (req, res) => {
  const { values, palette, steps, noDataFill, width, height, projection, title, format = "svg" } = req.body || {};

  if (!values || typeof values !== "object" || Array.isArray(values)) {
    return res.status(400).json({ error: "Body must include a `values` object keyed by country name." });
  }

  try {
    if (format === "geojson") {
      const { styled, domain, unmatchedKeys } = styleFeatures({ values, palette, steps, noDataFill });
      return res.json({ geojson: styled, domain, unmatchedKeys });
    }

    const { svg, domain } = renderSVG({ values, palette, steps, noDataFill, width, height, projection, title });
    res.json({ svg, domain });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Points (drawn on the map) ----------------------------------------------
app.get("/api/points", (req, res) => res.json(points.toGeoJSON()));

app.post("/api/points", (req, res) => {
  const { lat, lng, label } = req.body || {};
  if (typeof lat !== "number" || typeof lng !== "number") {
    return res.status(400).json({ error: "`lat` and `lng` must be numbers." });
  }
  res.status(201).json(points.add({ lat, lng, label }));
});

app.delete("/api/points/:id", (req, res) => {
  const removed = points.remove(req.params.id);
  res.status(removed ? 204 : 404).end();
});

app.delete("/api/points", (req, res) => {
  points.clear();
  res.status(204).end();
});

// ---- Geocoding passthrough (optional convenience for the point-drawing UI) --
app.get("/api/geocode", async (req, res) => {
  if (!req.query.text) return res.status(400).json({ error: "Provide ?text=" });
  try {
    res.json(await geocode(req.query.text));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Africa geo API listening on http://localhost:${PORT}`);
});
