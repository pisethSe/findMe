export interface Map3DScenePoint {
  latitude: number;
  longitude: number;
}

export const SEARCH_3D_MARKER_BUDGET = 24;

const AVAILABLE_GLYPH =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="m5 12 4 4L19 6"/></svg>';
const UNAVAILABLE_GLYPH =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="white" stroke-linecap="round" stroke-width="3" d="m7 7 10 10M17 7 7 17"/></svg>';

export const AVAILABLE_3D_GLYPH_SRC = svgDataUrl(AVAILABLE_GLYPH);
export const UNAVAILABLE_3D_GLYPH_SRC = svgDataUrl(UNAVAILABLE_GLYPH);

export function map3DSceneRange(
  origin: Map3DScenePoint,
  points: readonly Map3DScenePoint[],
  aspectRatio = 1,
): number {
  const furthestMeters = points.reduce(
    (maximum, point) => Math.max(maximum, haversineMeters(origin, point)),
    0,
  );
  // Fit the narrowest field of view, including portrait phones, and leave
  // room for marker labels. A fixed maximum would hide valid 20km results.
  const narrowDimension = Math.max(0.25, Math.min(1, aspectRatio));
  const fieldOfView = Math.tan(toRadians(42 / 2)) * narrowDimension;
  return Math.round(Math.max(1_350, (furthestMeters * 1.5) / fieldOfView));
}

function haversineMeters(
  origin: Map3DScenePoint,
  destination: Map3DScenePoint,
): number {
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = toRadians(destination.latitude - origin.latitude);
  const longitudeDelta = toRadians(destination.longitude - origin.longitude);
  const originLatitude = toRadians(origin.latitude);
  const destinationLatitude = toRadians(destination.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return (
    earthRadiusMeters *
    2 *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
