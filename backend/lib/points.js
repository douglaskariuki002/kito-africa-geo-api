// In-memory only — resets on server restart. Replace with a real database
// (Postgres/PostGIS is the natural fit) once this leaves prototype stage.
let points = [];
let nextId = 1;

function list() {
  return points;
}

function add({ lat, lng, label }) {
  const point = { id: nextId++, lat, lng, label: label || null, createdAt: new Date().toISOString() };
  points.push(point);
  return point;
}

function remove(id) {
  const before = points.length;
  points = points.filter((p) => p.id !== Number(id));
  return points.length < before;
}

function clear() {
  points = [];
}

function toGeoJSON() {
  return {
    type: "FeatureCollection",
    features: points.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      properties: { id: p.id, label: p.label, createdAt: p.createdAt },
    })),
  };
}

module.exports = { list, add, remove, clear, toGeoJSON };
