// Haversine straight-line distance. Used for technician matching.
// Abstracted so a real geocoding/maps provider can replace demo coordinates.

export function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// Addis Ababa sub-city demo coordinates (approximate centers).
export const ADDIS_ABABA_AREAS: Record<
  string,
  { latitude: number; longitude: number; radiusKm: number }
> = {
  Bole: { latitude: 8.9886, longitude: 38.7894, radiusKm: 6 },
  Kazanchis: { latitude: 9.015, longitude: 38.7644, radiusKm: 3 },
  Piazza: { latitude: 9.034, longitude: 38.7469, radiusKm: 3 },
  Arada: { latitude: 9.032, longitude: 38.752, radiusKm: 4 },
  Kirkos: { latitude: 8.999, longitude: 38.77, radiusKm: 4 },
  Yeka: { latitude: 9.022, longitude: 38.796, radiusKm: 5 },
  Lideta: { latitude: 9.008, longitude: 38.741, radiusKm: 4 },
  "Nifas Silk-Lafto": { latitude: 8.971, longitude: 38.76, radiusKm: 5 },
  "Kolfe Keranio": { latitude: 9.013, longitude: 38.721, radiusKm: 5 },
  Gulele: { latitude: 9.05, longitude: 38.739, radiusKm: 5 },
};
