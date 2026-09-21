# Kito — Africa geo API + map console

A small, working prototype of an Africa-focused geo service:

- **POST your own data → get a choropleth back**, as either a standalone SVG or a
  GeoJSON `FeatureCollection` styled with a `fill` color per country (ready to drop
  into any map library).
- **Interactive frontend** (MapLibre GL): native zoom/pan, a Geoapify basemap,
  the choropleth rendered as a live layer, and click-to-drop points with a
  persisted points list you can export as GeoJSON.

## Why the pieces are split the way they are

Geoapify's Boundaries API is built for looking up one place at a time
(`consists-of` / `part-of` a `place_id`), not "give me every country in a
continent" in a single call. So this project uses Geoapify for what it's
strongest at — basemap tiles/styles and geocoding — and bundles a real,
already-simplified Africa country-boundary GeoJSON (56 countries and
territories) for the choropleth geometry. If you'd rather source boundaries
live from Geoapify per `place_id`, `backend/lib/countries.js` is the one file
to swap.

## Setup

```bash
cd backend
npm install
cp .env.example .env        # then paste in your Geoapify API key
npm start                   # http://localhost:4000
```

Open `http://localhost:4000` — the frontend is served from `backend/public`
and talks to the same server. (A standalone copy also lives in
`frontend/index.html` if you want to host the UI separately; just point
`API_BASE` in its `<script>` at your backend's URL.)

Get a free Geoapify key at https://myprojects.geoapify.com/ — the free tier
covers this whole prototype.

## API

### `GET /api/map-config`
Returns a tile URL with your API key already attached, plus a default
center/zoom over Africa. The frontend calls this once so the key never has
to sit in client-side source.

### `GET /api/countries`
List of the 56 country/territory names the bundled boundary file recognizes.

### `GET /api/boundaries`
The raw Africa boundary GeoJSON.

### `POST /api/choropleth`
```jsonc
{
  "values": { "Kenya": 92, "Nigeria": 226, "Egypt": 103 }, // name → number
  "palette": "sand",       // sand | teal | blues | oranges | viridis
  "steps": 5,               // optional: N discrete classes instead of a smooth ramp
  "noDataFill": "#e7e9ec",  // optional
  "format": "svg"           // "svg" (default) or "geojson"
}
```
- `format: "svg"` → `{ svg: "<svg ...>", domain: [min, max] }`
- `format: "geojson"` → `{ geojson: FeatureCollection, domain, unmatchedKeys }`
  — `unmatchedKeys` lists any keys in `values` that couldn't be matched to a
  country (common aliases like "Ivory Coast" or "DR Congo" already resolve
  automatically — see `ALIASES` in `lib/countries.js`).

### `GET /api/points` / `POST /api/points` / `DELETE /api/points/:id` / `DELETE /api/points`
Points dropped on the map. In-memory only (resets on restart) — swap
`lib/points.js` for a real database (Postgres/PostGIS is the natural fit)
before this leaves prototype stage.

### `GET /api/geocode?text=...`
Thin proxy to Geoapify's geocoder, scoped to the African continent, so the
API key never reaches the browser.

## Frontend notes

- Zoom and pan are MapLibre GL's native behavior (scroll-wheel zoom, drag
  pan, double-click zoom) plus the on-screen zoom/compass control —
  nothing custom to maintain.
- The choropleth is added as a `fill` layer sourced from `/api/choropleth`
  with `format: "geojson"`, so it stays interactive (hoverable, zoomable)
  rather than a static image.
- "Drop points" toggles a click handler that POSTs `{lat, lng}` to
  `/api/points` and re-renders the point layer + sidebar list.
