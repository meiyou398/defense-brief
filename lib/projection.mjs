import { geoNaturalEarth1 } from 'd3-geo';

export const WIDTH = 900;
export const HEIGHT = 640;
export const FIT_POINTS = [[-15, -38], [155, 70], [-15, 70], [155, -38]];

export function makeProjection() {
  return geoNaturalEarth1()
    .fitExtent([[0, 0], [WIDTH, HEIGHT]], { type: 'MultiPoint', coordinates: FIT_POINTS })
    .clipExtent([[0, 0], [WIDTH, HEIGHT]]);
}

export function markerPosition(location, projection = makeProjection()) {
  if (!location || location.offMap || !Number.isFinite(location.lat) || !Number.isFinite(location.lon)) return null;
  const point = projection([location.lon, location.lat]);
  if (!point || point.some(n => !Number.isFinite(n))) return null;
  const [x, y] = point;
  if (x < 0 || x > WIDTH || y < 0 || y > HEIGHT) return null;
  return { left: +(x / WIDTH * 100).toFixed(2), top: +(y / HEIGHT * 100).toFixed(2) };
}

// Same grouping rule as the supplied handoff: add a marker to the first group
// containing a nearby member, preserving input/issue numbering order.
export function groupMarkers(markers, minDist = 24) {
  const groups = [];
  for (const marker of markers) {
    const near = other => Math.hypot((other.left - marker.left) / 100 * WIDTH, (other.top - marker.top) / 100 * HEIGHT) < minDist;
    const group = groups.find(candidate => candidate.some(near));
    if (group) group.push(marker);
    else groups.push([marker]);
  }
  return groups;
}
