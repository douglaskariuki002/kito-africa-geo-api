const fetch = require("node-fetch");

const BASE = "https://api.geoapify.com/v1";

function requireKey() {
  const key = process.env.GEOAPIFY_API_KEY;
  if (!key) throw new Error("GEOAPIFY_API_KEY is not set (see .env.example)");
  return key;
}

// Vector/raster tile template for MapLibre GL. Sent to the frontend so the
// API key is only ever attached server-side to this one string, not spread
// across client code.
function tileUrl(style = "osm-bright") {
  const key = requireKey();
  return `https://maps.geoapify.com/v1/tile/${style}/{z}/{x}/{y}.png?apiKey=${key}`;
}

function vectorStyleUrl(style = "osm-bright") {
  const key = requireKey();
  return `https://maps.geoapify.com/v1/styles/${style}/style.json?apiKey=${key}`;
}

// Thin proxy so a place name can be resolved to coordinates for a dropped
// point, without exposing the API key to the browser.
async function geocode(text) {
  const key = requireKey();
  const url = `${BASE}/geocode/search?text=${encodeURIComponent(text)}&filter=continent:africa&apiKey=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geoapify geocode failed: ${res.status}`);
  return res.json();
}

module.exports = { tileUrl, vectorStyleUrl, geocode };
